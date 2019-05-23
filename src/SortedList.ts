enum SortRelationship {
    Greater = 1,
    Less = -1,
    Equal = 0
}
enum Direction {
    right = 1,
    up = 0,
    left = 2,
    none = -1
}

interface IConstructorOptions {
    dedupe: 'byref' | 'bykey' | 'disabled';
}

export class SortedList<K, V> {
    private root?: BTNode<K, V>;
    private least?: BTNode<K, V>;
    private greatest?: BTNode<K, V>;
    private size = 0;
    private keyAccessor: (item: V) => K;
    private nodeStorageType: new (item: V) => INodeStorage<V>;

    constructor(
        private comparer: (pivot: K, other: K) => number | SortRelationship,
        keyAccessor?: (item: V) => K,
        options?: IConstructorOptions
    ) {
        this.keyAccessor = keyAccessor || (v => (v as unknown) as K);
        this.nodeStorageType = !options
            ? NodeArrayStorage
            : options.dedupe === 'disabled'
            ? NodeArrayStorage
            : options.dedupe === 'bykey'
            ? NodeSingleItemStorage
            : options.dedupe === 'byref'
            ? NodeSetStorage
            : NodeArrayStorage;
    }

    /**
     * O(1), Get number of items in the list, including those with a duplicate key
     */
    public getSize() {
        return this.size;
    }

    /**
     * O(1), Get root of AVL tree
     */
    public getRoot() {
        return this.root;
    }

    /**
     * O(1), Get the node sorted to the beginning of the list
     */
    public getHead() {
        return this.least;
    }

    /**
     * O(1), Get the node sorted to the end of the list
     */
    public getTail() {
        return this.greatest;
    }

    /**
     * O(log n), Find items by key
     * @param key
     */
    public find(key: K) {
        const node = this.findNode(key);
        return node ? node.getItems() : SortedList.empty<V>();
    }

    /**
     * O(log n), Find a single item by key
     * @param key
     */
    public findOne(key: K) {
        for (let item of this.find(key)) {
            return item;
        }
    }

    public getRange(rng: Partial<{ gt: K; gte: K; lt: K; lte: K }>) {
        const lowerBound = rng.gt !== undefined ? rng.gt : rng.gte,
            startNode = this.findLowest(lowerBound, lowerBound === rng.gte),
            upperBound = rng.lt !== undefined ? rng.lt : rng.lte,
            upperEq = rng.lte === upperBound ? 0 : undefined,
            ascendCheck =
                upperBound === undefined
                    ? () => true
                    : (key: K) => {
                          const value = this.comparer(key, upperBound);
                          return value < 0 || value === upperEq;
                      },
            ascendingIterable = SortedList.nodesAscendingWhile(startNode, ascendCheck);

        return SortedList.itemsIterable(ascendingIterable);
    }

    /**
     * O(args log n), Add one or more items
     * @param items
     */
    public add(...items: V[]) {
        let result = false;

        for (let item of items) {
            let key = this.keyAccessor(item);
            if (!this.root) {
                this.least = this.greatest = this.root = new BTNode<K, V>(item, key, new this.nodeStorageType(item));
                this.size = 1;
                result = true;
            } else {
                if (this.addItem(key, item)) {
                    result = true;
                }
            }
        }

        return result;
    }

    /**
     * O(args log n), Remove items, return true if anything was removed
     * @param items
     */
    public remove(...items: V[]) {
        let result = false;

        for (let item of items) {
            if (this.removeItem(item)) {
                result = true;
            }
        }

        return result;
    }

    /**
     * O(1) to start, O(n) if fully iterated, Get iterator for list
     * @param desc true to get items in reverse order
     */
    public getItems(desc?: boolean) {
        return desc ? SortedList.itemsDescending(this.greatest) : SortedList.itemsAscending(this.least);
    }

    /**
     * O(1), get item sorted to the beginning of the list
     */
    public getMin() {
        if (this.least) {
            for (let item of this.least.getItems()) {
                return item;
            }
        }
    }
    /**
     * O(1), get item sorted to the end of the list
     */
    public getMax() {
        if (this.greatest) {
            for (let item of this.greatest.getItems()) {
                return item;
            }
        }
    }

    //#region
    public static ofType<K extends number | Date, V>(
        keyAccessor: (value: V) => K,
        options?: IConstructorOptions
    ): SortedList<K, V> {
        return new SortedList(SortedList.primitiveComparer<K>(), keyAccessor, options);
    }

    public static ofTypeString<K extends string, V>(
        keyAccessor: (value: V) => K,
        options: Intl.CollatorOptions & IConstructorOptions = { sensitivity: 'base', dedupe: 'byref' },
        locales?: string[] | undefined
    ): SortedList<K, V> {
        return new SortedList(SortedList.stringComparer(options, locales), keyAccessor, options);
    }

    public static ofNumber() {
        return new SortedList<number, number>(SortedList.primitiveComparer<number>(), undefined, { dedupe: 'bykey' });
    }

    public static ofDate() {
        return new SortedList<Date, Date>(SortedList.primitiveComparer<Date>(), undefined, { dedupe: 'bykey' });
    }

    public static ofString(
        option: Intl.CollatorOptions & IConstructorOptions = { sensitivity: 'base', dedupe: 'bykey' },
        locales?: string[] | undefined
    ) {
        return new SortedList<string, string>(SortedList.stringComparer(option, locales));
    }
    //#endregion

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
    private static nodesAscendingWhile = function*<K, V>(start: BTNode<K, V> | undefined, check: (item: K) => boolean) {
        for (let node of SortedList.nodesAscending(start)) {
            if (check(node.key)) {
                yield node;
            }
        }
    };
    private static itemsAscending = function<K, V>(least?: BTNode<K, V>) {
        return SortedList.itemsIterable(SortedList.nodesAscending(least));
    };
    private static nodesAscending = function*<K, V>(least?: BTNode<K, V>) {
        let curr = least;
        while (curr) {
            yield curr;
            curr = curr.next;
        }
    };
    private static itemsDescending = function<K, V>(greatest?: BTNode<K, V>) {
        return SortedList.itemsIterable(SortedList.nodesDescending(greatest));
    };
    private static nodesDescending = function*<K, V>(greatest?: BTNode<K, V>) {
        let curr = greatest;
        while (curr) {
            yield curr;
            curr = curr.prev;
        }
    };
    private static itemsIterable = function*<K, V>(nodes: IterableIterator<BTNode<K, V>>) {
        for (let node of nodes) {
            for (let item of node.getItems()) {
                yield item;
            }
        }
    };

    private static empty = function*<V>(): IterableIterator<V> {
        if (false) yield undefined as any;
    };
    //#endregion

    //#region Find
    private findNode(item: K) {
        let curr = this.root,
            value = 0;
        while (curr) {
            value = this.comparer(curr.key, item);
            if (value < 0) {
                curr = curr.right;
            } else if (value > 0) {
                curr = curr.left;
            } else {
                return curr;
            }
        }
    }

    private findLowest(greaterThan: K | undefined, orEqual: boolean) {
        let curr = this.root,
            value = 0,
            result = this.least;

        if (greaterThan !== undefined) {
            while (curr) {
                value = this.comparer(curr.key, greaterThan);
                if (value === 0) {
                    if (orEqual) {
                        result = curr;
                        break;
                    } else {
                        curr = curr.right;
                    }
                } else if (value > 0) {
                    result = curr;
                    curr = curr.left;
                } else if (value < 0) {
                    curr = curr.right;
                }
            }
        }

        return result;
    }
    //#endregion

    //#region Add
    private addItem(key: K, item: V) {
        let comparer = this.comparer,
            curr: BTNode<K, V> | undefined = this.root!,
            value = 0,
            rebalanceDir = 0,
            added = false,
            newItem: BTNode<K, V>,
            isLeast = true,
            isGreatest = true;

        while (curr) {
            value = comparer(curr.key, key);
            if (value > 0) {
                isGreatest = false;
                if (curr.left) {
                    curr = curr.left;
                } else {
                    newItem = new BTNode(item, key, new this.nodeStorageType(item));
                    if (isLeast) {
                        this.least = newItem;
                    }
                    curr.setPrev(newItem);
                    curr.setLeft(newItem);
                    rebalanceDir = 1;
                }
            } else if (value < 0) {
                isLeast = false;
                if (curr.right) {
                    curr = curr.right;
                } else {
                    newItem = new BTNode(item, key, new this.nodeStorageType(item));
                    if (isGreatest) {
                        this.greatest = newItem;
                    }
                    curr.setNext(newItem);
                    curr.setRight(newItem);
                    rebalanceDir = -1;
                }
            } else {
                if (curr.addItem(item)) {
                    this.size += 1;
                    added = true;
                }
                break;
            }

            if (rebalanceDir) {
                added = true;
                this.size += 1;
                this.balanceInsertion(curr, rebalanceDir);
                break;
            }
        }

        return added;
    }

    private balanceInsertion(node: BTNode<K, V>, direction: number) {
        let balance = direction,
            parent: undefined | BTNode<K, V>,
            curr: undefined | BTNode<K, V> = node;

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
    private removeItem(item: V) {
        let node = this.root,
            comparer = this.comparer,
            value: number,
            result = false,
            itemKey = this.keyAccessor!(item);

        while (node) {
            value = comparer(node.key, itemKey);
            if (value < 0) {
                node = node.right;
            } else if (value > 0) {
                node = node.left;
            } else {
                const left = node.left,
                    right = node.right,
                    removalResult = node.removeItem(item);

                if (removalResult === RemovalResult.Empty) {
                    if (node === this.least) {
                        this.least = node.next;
                    }
                    if (node === this.greatest) {
                        this.greatest = node.prev;
                    }
                    if (node.next) {
                        node.next.prev = node.prev;
                    }
                    if (node.prev) {
                        node.prev.next = node.next;
                    }

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

                            if (succParent.left === successor) {
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

    private balanceDeletion(node: BTNode<K, V>, direction: number) {
        let curr: undefined | BTNode<K, V> = node,
            balance = direction,
            parent: undefined | BTNode<K, V>;
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
    private rotateLeft(node: BTNode<K, V>) {
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
    private rotateRight(node: BTNode<K, V>) {
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
    private rotateLeftRight(node: BTNode<K, V>) {
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
    private rotateRightLeft(node: BTNode<K, V>) {
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

export const describeSortedList = <K, V>(tree: SortedList<K, V>) => {
    const printNode = (node?: BTNode<K, V>): string => {
        if (!node) {
            return '-';
        } else {
            let item = node.key,
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

class BTNode<K, V> {
    public prev?: BTNode<K, V>;
    public next?: BTNode<K, V>;
    public left?: BTNode<K, V>;
    public right?: BTNode<K, V>;
    public balance = 0;
    public parent?: BTNode<K, V>;
    public readonly key: K;

    private items: INodeStorage<V>;

    constructor(item: V, key: K, itemStorage: INodeStorage<V>) {
        this.key = key;
        this.items = itemStorage;
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
            removed = this.items.remove(item);

        if (removed) {
            if (this.items.size() === 0) {
                isEmpty = true;
            }
        }

        return isEmpty ? RemovalResult.Empty : removed ? RemovalResult.Removed : RemovalResult.NotRemoved;
    }
    public hasItem(item: V) {
        return this.items.has(item);
    }
    public getItems() {
        return this.items.getItems();
    }
    public getItem() {
        for (let item of this.getItems()) {
            return item;
        }
    }
    public setLeft(left?: BTNode<K, V>) {
        this.left = left;
        this.setChild(left);
    }
    public setRight(right?: BTNode<K, V>) {
        this.right = right;
        this.setChild(right);
    }
    public setAsChild(parent: BTNode<K, V> | undefined, previousChild: BTNode<K, V>) {
        if (parent) {
            if (parent.right === previousChild) {
                parent.right = this;
            } else if (parent.left === previousChild) {
                parent.left = this;
            }
        }
        this.parent = parent;
    }
    private setChild(child?: BTNode<K, V>) {
        if (child) {
            child.parent = this;
        }
    }
    public setPrev(prev?: BTNode<K, V>) {
        if (this.prev) {
            this.prev.next = prev;
        }
        if (prev) {
            prev.prev = this.prev;
            prev.next = this;
        }
        this.prev = prev;
    }
    public setNext(next?: BTNode<K, V>) {
        if (this.next) {
            this.next.prev = next;
        }
        if (next) {
            next.next = this.next;
            next.prev = this;
        }
        this.next = next;
    }
}

export class NodeSetStorage<T> implements INodeStorage<T> {
    private set = new Set<T>();
    constructor(item: T) {
        this.set.add(item);
    }
    has(item: T) {
        return this.set.has(item);
    }
    getItems() {
        return this.set.values();
    }
    add(item: T) {
        if (!this.set.has(item)) {
            this.set.add(item);
            return true;
        }
        return false;
    }
    remove(item: T) {
        return this.set.delete(item);
    }
    size() {
        return this.set.size;
    }
}

export class NodeSingleItemStorage<T> implements INodeStorage<T> {
    private item: T | undefined;
    constructor(item: T) {
        this.item = item;
    }
    has(item: T) {
        return this.item === item;
    }
    private static iterator = function*<T>(item?: T) {
        if (item) {
            yield item;
        }
    };
    getItems() {
        return NodeSingleItemStorage.iterator<T>(this.item);
    }
    add(item: T) {
        this.item = item;
        return false;
    }
    size() {
        return this.item ? 1 : 0;
    }
    remove(item: T) {
        if (item === this.item) {
            this.item = undefined;
            return true;
        }
        return false;
    }
}

export class NodeArrayStorage<T> implements INodeStorage<T> {
    private items: T[] = [];
    private static iterator = function*<T>(items: T[]) {
        for (let item of items) {
            yield item;
        }
    };
    constructor(item: T) {
        this.items.push(item);
    }
    has(item: T) {
        return this.items.indexOf(item) >= 0;
    }
    getItems() {
        return NodeArrayStorage.iterator(this.items);
    }
    add(item: T) {
        this.items.push(item);
        return true;
    }
    size() {
        return this.items.length;
    }
    remove(item: T) {
        let pos = this.items.indexOf(item);
        if (pos >= 0) {
            this.items.splice(pos, 1);
            return this.items.length > 0;
        }
        return false;
    }
}

interface INodeStorage<T> {
    has: (item: T) => boolean;
    getItems: () => IterableIterator<T>;
    add: (item: T) => boolean;
    remove: (item: T) => boolean;
    size: () => number;
}
