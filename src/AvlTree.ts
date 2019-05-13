import { jsxOpeningElement } from '@babel/types';

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

export class BTree<T> {
    private root?: BTNode<T>;
    private size = 0;

    constructor(private comparer: (pivot: T, other: T) => number | SortRelationship) {}

    public getSize() {
        return this.size;
    }

    public getRoot() {
        return this.root;
    }

    public find(item: T) {
        return BTree.find<T>(this, item);
    }

    //#region Iterate
    private static find = function*<T>(tree: BTree<T>, item: T) {
        const comparer = tree.comparer;
        let curr = tree.root,
            value = 0;
        while (curr) {
            value = comparer(curr.getOne(), item);
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

    private static iterateItems = function*<T>(root?: BTNode<T>) {
        for (let node of BTree.iterateNodes(root)) {
            for (let item of node.getItems()) {
                yield item;
            }
        }
    };
    private static iterateNodes = function*<T>(root?: BTNode<T>) {
        let nextDir = Direction.right,
            curr = root!,
            right: BTNode<T> | undefined = curr,
            prev: BTNode<T>;
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
    public add(...items: T[]) {
        for (let item of items) {
            let newNode = new BTNode<T>(item);
            if (!this.root) {
                this.root = newNode;
                this.size = 1;
            } else {
                this.addItem(newNode);
            }
        }
    }

    private addItem(newNode: BTNode<T>) {
        let comparer = this.comparer,
            curr: BTNode<T> | undefined = this.root!,
            value = 0,
            rebalanceDir = 0;

        while (curr) {
            value = comparer(curr.getOne(), newNode.getOne());
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

    private balanceInsertion(node: BTNode<T>, direction: number) {
        let balance = direction,
            parent: undefined | BTNode<T>,
            curr: undefined | BTNode<T> = node;

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
    public remove(...items: T[]) {
        for (let item of items) {
            this.removeItem(item);
        }
    }

    private removeItem(item: T) {
        let node = this.root,
            comparer = this.comparer,
            value: number,
            result = false;

        while (node) {
            value = comparer(node.getOne(), item);
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

    private balanceDeletion(node: BTNode<T>, direction: number) {
        let curr: undefined | BTNode<T> = node,
            balance = direction,
            parent: undefined | BTNode<T>;
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
    private rotateLeft(node: BTNode<T>) {
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
    private rotateRight(node: BTNode<T>) {
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
    private rotateLeftRight(node: BTNode<T>) {
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
    private rotateRightLeft(node: BTNode<T>) {
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

export const stringifyBtree = <T>(tree: BTree<T>) => {
    const printNode = (node?: BTNode<T>): string => {
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

class BTNode<T> {
    public left?: BTNode<T>;
    public right?: BTNode<T>;
    public balance = 0;
    public parent?: BTNode<T>;

    private items: Set<T> = new Set<T>();
    private anItem: T;
    private static iterator = function*<T>(items: Set<T>) {
        for (let item of items.values()) {
            yield item;
        }
    };

    constructor(item: T) {
        this.anItem = item;
        this.items.add(item);
    }

    public addItem(item: T) {
        if (!this.items.has(item)) {
            this.items.add(item);
            return true;
        }
        return false;
    }
    public removeItem(item: T) {
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
    public hasItem(item: T) {
        return this.items.has(item);
    }
    public getItems() {
        return BTNode.iterator<T>(this.items);
    }
    public getOne() {
        return this.anItem;
    }
    public setLeft(left?: BTNode<T>) {
        this.left = left;
        this.setChild(left);
    }
    public setRight(right?: BTNode<T>) {
        this.right = right;
        this.setChild(right);
    }
    public setAsChild(parent: BTNode<T> | undefined, previousChild: BTNode<T>) {
        if (parent) {
            if (parent.right === previousChild) {
                parent.right = this;
            } else if (parent.left === previousChild) {
                parent.left = this;
            }
        }
        this.parent = parent;
    }
    private setChild(child?: BTNode<T>) {
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
