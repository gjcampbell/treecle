enum SortRelationship {
    Greater = 1,
    Less = -1,
    Equal = 0
}
enum Direction {
    right = 1,
    up = 0,
    none = -1
}

export class BTree<K, V> {
    private root?: BTNode<V>;
    private size = 0;

    constructor(
        private comparer: (pivot: K, other: K) => number | SortRelationship,
        private keyAccessor?: (item: V) => K
    ) {
        if (!keyAccessor) {
            this.keyAccessor = v => (v as unknown) as K;
        }
    }

    public getSize() {
        return this.size;
    }

    public getRoot() {
        return this.root;
    }

    public find(key: K) {
        return BTree.find<K, V>(this, key);
    }

    public static ofType<K extends number | Date, V>(keyAccessor: (value: V) => K): BTree<K, V> {
        return new BTree(BTree.primitiveComparer<K>(), keyAccessor);
    }
    public static ofTypeString<K extends string, V>(
        keyAccessor: (value: V) => K,
        option: Intl.CollatorOptions = { sensitivity: 'base' },
        locales?: string[] | undefined
    ): BTree<K, V> {
        return new BTree(BTree.stringComparer(option, locales), keyAccessor);
    }
    public static ofNumber() {
        return new BTree<number, number>(BTree.primitiveComparer<number>());
    }
    public static ofDate() {
        return new BTree<Date, Date>(BTree.primitiveComparer<Date>());
    }
    public static ofString(option: Intl.CollatorOptions = { sensitivity: 'base' }, locales?: string[] | undefined) {
        return new BTree<string, string>(BTree.stringComparer(option, locales));
    }

    //#region Comparers
    private static stringComparer(
        option: Intl.CollatorOptions = { sensitivity: 'base' },
        locales?: string[] | undefined
    ) {
        return (a: string, b: string) => {
            return a.localeCompare(b, locales, option);
        };
    }
    private static primitiveComparer<T extends number | Date>() {
        return (a: T, b: T) => {
            return a > b ? 1 : a < b ? -1 : 0;
        };
    }
    //#endregion

    //#region Iterate
    private static find = function*<K, V>(tree: BTree<K, V>, item: K) {
        const comparer = tree.comparer;
        let curr = tree.root,
            value = 0;
        while (curr) {
            value = comparer(tree.keyAccessor!(curr.getOne()), item);
            if (value < 0) {
                curr = curr.right;
            } else if (value > 0) {
                curr = curr.left;
            } else {
                for (let item of curr.getItems()) {
                    yield item;
                }
                break;
            }
        }
    };

    private static iterateItems = function*<V>(root?: BTNode<V>) {
        for (let node of BTree.iterateNodes(root)) {
            for (let item of node.getItems()) {
                yield item;
            }
        }
    };
    private static iterateNodes = function*<V>(root?: BTNode<V>) {
        let nextDir = Direction.right,
            curr = root!,
            right: BTNode<V> | undefined = curr,
            prev: BTNode<V>;
        while (curr) {
            if (nextDir === Direction.right) {
                curr = right!;
                while (curr.left) {
                    curr = curr.left;
                }
                right = curr.right;
                nextDir = right ? Direction.right : Direction.up;
                yield curr!;
            } else if (nextDir === Direction.up) {
                nextDir = Direction.none;
                while (curr.parent) {
                    prev = curr;
                    curr = curr.parent!;
                    if (curr.left === prev) {
                        right = curr.right;
                        nextDir = right ? Direction.right : Direction.up;
                        yield curr!;
                        break;
                    }
                }
            } else {
                break;
            }
        }
    };
    public getItems() {
        return BTree.iterateItems(this.root);
    }

    public getNodes() {
        return BTree.iterateNodes(this.root);
    }
    //#endregion

    //#region Add
    public add(...items: V[]) {
        for (let item of items) {
            let newNode = new BTNode<V>(item);
            if (!this.root) {
                this.root = newNode;
                this.size = 1;
            } else {
                this.addItem(newNode);
            }
        }
    }

    private addItem(newNode: BTNode<V>) {
        let comparer = this.comparer,
            curr: BTNode<V> | undefined = this.root!,
            value = 0,
            rebalanceDir = 0;

        while (curr) {
            value = comparer(this.keyAccessor!(curr.getOne()), this.keyAccessor!(newNode.getOne()));
            if (value > 0) {
                if (curr.left) {
                    curr = curr.left;
                } else {
                    curr.setLeft(newNode);
                    rebalanceDir = 1;
                }
            } else if (value < 0) {
                if (curr.right) {
                    curr = curr.right;
                } else {
                    curr.setRight(newNode);
                    rebalanceDir = -1;
                }
            } else {
                if (curr.addItem(newNode.getOne())) {
                    this.size += 1;
                }
                break;
            }

            if (rebalanceDir) {
                this.size += 1;
                this.balanceInsertion(curr, rebalanceDir);
                break;
            }
        }
    }

    private balanceInsertion(node: BTNode<V>, direction: number) {
        let balance = direction,
            parent: undefined | BTNode<V>,
            curr: undefined | BTNode<V> = node;

        while (curr) {
            balance = curr.balance += balance;
            if (balance === 0) {
                break;
            } else if (balance === 2) {
                if (curr.left!.balance === 1) {
                    this.rotateRight(curr);
                } else {
                    this.rotateLeftRight(curr);
                }
                break;
            } else if (balance === -2) {
                if (curr.right!.balance == -1) {
                    this.rotateLeft(curr);
                } else {
                    this.rotateRightLeft(curr);
                }
                break;
            }

            parent = curr.parent;
            if (parent) {
                balance = parent.left === curr ? 1 : -1;
            }
            curr = parent;
        }
    }
    //#endregion

    //#region Remove
    public remove(...items: V[]) {
        for (let item of items) {
            this.removeItem(item);
        }
    }

    private removeItem(item: V) {
        let node = this.root,
            comparer = this.comparer,
            value: number,
            result = false;

        while (node) {
            value = comparer(this.keyAccessor!(node.getOne()), this.keyAccessor!(item));
            if (value < 0) {
                node = node.right;
            } else if (value > 0) {
                node = node.left;
            } else {
                const left = node.left,
                    right = node.right,
                    removalResult = node.removeItem(item);

                if (removalResult === RemovalResult.Empty) {
                    result = true;
                    if (!left) {
                        if (!right) {
                            if (node === this.root) {
                                this.root = undefined;
                            } else {
                                const parent = node.parent!;
                                if (parent.left === node) {
                                    parent.left = undefined;
                                    this.balanceDeletion(parent, -1);
                                } else {
                                    parent.right = undefined;
                                    this.balanceDeletion(parent, 1);
                                }
                            }
                        } else {
                            right.setAsChild(node.parent, node);
                            this.balanceDeletion(right, 0);

                            if (node === this.root) {
                                this.root = right;
                            }
                        }
                    } else if (!right) {
                        left.setAsChild(node.parent, node);
                        this.balanceDeletion(left, 0);

                        if (node === this.root) {
                            this.root = left;
                        }
                    } else {
                        const parent = node.parent;
                        let successor = right;

                        if (!successor.left) {
                            successor.setAsChild(parent, node);
                            successor.setLeft(left);
                            successor.balance = node.balance;

                            if (node === this.root) {
                                this.root = successor;
                            }

                            this.balanceDeletion(successor, 1);
                        } else {
                            while (successor.left) {
                                successor = successor.left;
                            }

                            const succParent = successor.parent!,
                                succRight = successor.right;

                            if (succParent.left === succParent) {
                                succParent.left = succRight;
                            } else {
                                succParent.right = succRight;
                            }

                            if (succRight) {
                                succRight.parent = succParent;
                            }

                            successor.setAsChild(parent, node);
                            successor.setLeft(left);
                            successor.balance = node.balance;
                            successor.setRight(right);

                            if (node === this.root) {
                                this.root = successor;
                            }

                            this.balanceDeletion(succParent, -1);
                        }
                    }

                    break;
                } else {
                    result = removalResult === RemovalResult.Removed;
                    break;
                }
            }
        }

        if (result) {
            this.size -= 1;
        }

        return result;
    }

    private balanceDeletion(node: BTNode<V>, direction: number) {
        let curr: undefined | BTNode<V> = node,
            balance = direction,
            parent: undefined | BTNode<V>;
        while (curr) {
            balance = curr.balance += balance;

            if (balance === 2) {
                if (curr.left!.balance >= 0) {
                    curr = this.rotateRight(curr);
                    if (curr.balance === -1) {
                        break;
                    }
                } else {
                    curr = this.rotateLeftRight(curr);
                }
            } else if (balance === -2) {
                if (curr.right!.balance <= 0) {
                    curr = this.rotateLeft(curr);
                    if (curr.balance === 1) {
                        break;
                    }
                } else {
                    curr = this.rotateRightLeft(curr);
                }
            } else if (balance !== 0) {
                break;
            }

            parent = curr.parent;
            if (parent) {
                balance = parent.left === curr ? -1 : 1;
            }
            curr = parent;
        }
    }
    //#endregion

    //#region Rotate
    private rotateLeft(node: BTNode<V>) {
        const right = node.right!,
            rightsLeft = right.left,
            parent = node.parent;

        right.setAsChild(parent, node);
        right.setLeft(node);
        node.setRight(rightsLeft);
        if (node === this.root) {
            this.root = right;
        }

        right.balance++;
        node.balance = -right.balance;

        return right;
    }
    private rotateRight(node: BTNode<V>) {
        const left = node.left!,
            leftsRight = left.right,
            parent = node.parent;

        left.setAsChild(parent, node);
        left.setRight(node);
        node.setLeft(leftsRight);
        if (node === this.root) {
            this.root = left;
        }

        left.balance--;
        node.balance = -left.balance;

        return left;
    }
    private rotateLeftRight(node: BTNode<V>) {
        const left = node.left!,
            leftsRight = left.right!,
            parent = node.parent,
            leftsRightRight = leftsRight.right,
            leftsRightLeft = leftsRight.left;

        leftsRight.setAsChild(parent, node);
        node.setLeft(leftsRightRight);
        left.setRight(leftsRightLeft);
        leftsRight.setLeft(left);
        leftsRight.setRight(node);

        if (node === this.root) {
            this.root = leftsRight;
        }

        if (leftsRight.balance === -1) {
            node.balance = 0;
            left.balance = 1;
        } else if (leftsRight.balance === 0) {
            node.balance = 0;
            left.balance = 0;
        } else {
            node.balance = -1;
            left.balance = 0;
        }

        leftsRight.balance = 0;

        return leftsRight;
    }
    private rotateRightLeft(node: BTNode<V>) {
        let right = node.right!,
            rightsLeft = right.left!,
            parent = node.parent,
            rightsLeftLeft = rightsLeft.left,
            rightsLeftRight = rightsLeft.right;

        rightsLeft.setAsChild(parent, node);
        node.setRight(rightsLeftLeft);
        right.setLeft(rightsLeftRight);
        rightsLeft.setRight(right);
        rightsLeft.setLeft(node);

        if (node === this.root) {
            this.root = rightsLeft;
        }

        if (rightsLeft.balance === 1) {
            node.balance = 0;
            right.balance = -1;
        } else if (rightsLeft.balance === 0) {
            node.balance = 0;
            right.balance = 0;
        } else {
            node.balance = 1;
            right.balance = 0;
        }

        rightsLeft.balance = 0;

        return rightsLeft;
    }
    //#endregion
}

export const stringifyBtree = <K, V>(tree: BTree<K, V>) => {
    const printNode = (node?: BTNode<V>): string => {
        if (!node) {
            return '-';
        } else {
            let item = node.getOne(),
                children = node.left || node.right ? `(${printNode(node.left)},${printNode(node.right)})` : '',
                toString = typeof item === 'object' ? JSON.stringify(item) : item;
            return `${toString}${children}`;
        }
    };
    return printNode(tree.getRoot());
};

enum RemovalResult {
    NotRemoved = 0,
    Empty = 1,
    Removed = 2
}

class BTNode<V> {
    public left?: BTNode<V>;
    public right?: BTNode<V>;
    public balance = 0;
    public parent?: BTNode<V>;

    private items: Set<V> = new Set<V>();
    private anItem: V;
    private static iterator = function*<V>(items: Set<V>) {
        for (let item of items.values()) {
            yield item;
        }
    };

    constructor(item: V) {
        this.anItem = item;
        this.items.add(item);
    }

    public addItem(item: V) {
        if (!this.items.has(item)) {
            this.items.add(item);
            return true;
        }
        return false;
    }
    public removeItem(item: V) {
        let isEmpty = false,
            removed = this.items.delete(item);

        if (item === this.anItem) {
            let newFirst = this.findAnyItem();
            if (newFirst) {
                this.anItem = newFirst;
            } else {
                isEmpty = true;
            }
        }

        return isEmpty ? RemovalResult.Empty : removed ? RemovalResult.Removed : RemovalResult.NotRemoved;
    }
    public hasItem(item: V) {
        return this.items.has(item);
    }
    public getItems() {
        return BTNode.iterator<V>(this.items);
    }
    public getOne() {
        return this.anItem;
    }
    public setLeft(left?: BTNode<V>) {
        this.left = left;
        this.setChild(left);
    }
    public setRight(right?: BTNode<V>) {
        this.right = right;
        this.setChild(right);
    }
    public setAsChild(parent: BTNode<V> | undefined, previousChild: BTNode<V>) {
        if (parent) {
            if (parent.right === previousChild) {
                parent.right = this;
            } else if (parent.left === previousChild) {
                parent.left = this;
            }
        }
        this.parent = parent;
    }
    private setChild(child?: BTNode<V>) {
        if (child) {
            child.parent = this;
        }
    }
    private findAnyItem() {
        for (let item of this.getItems()) {
            return item;
        }
    }
}
