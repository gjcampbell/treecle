export class TreeQuery<T> {
    constructor(private childAccessor?: (item: T) => T[] | undefined) {}
    public query(items: T[]) {
        return Query.init<T>(items, this.childAccessor);
    }
}

export class Query<T> implements Iterable<Node<T>> {
    private rootNode!: Node<T>;
    private nodeLookup = new Map<T, Node<T>>();
    private iterate: () => IterableIterator<Node<T>>;
    private customMove: (current: Node<T>, defaultNext?: Node<T>) => Node<T> | undefined = (current, def) => def;

    private constructor(iterator?: () => IterableIterator<Node<T>>) {
        this.iterate = iterator ? iterator : this.forwardIterator();
    }

    public static init<T>(items: T[], childAccessor?: (item: T) => T[] | undefined) {
        let query = new Query<T>(),
            rootIndex = -1,
            rootItem = { items } as any,
            depth = -1;

        const createNode = (item: T, parent?: Node<T>, prev?: Node<T>, index?: number): Node<T> => {
            const children: Node<T>[] = [],
                result = new Node<T>(prev, parent, depth, item, rootIndex++, index || 0, children),
                childItems = item === rootItem ? rootItem.items : childAccessor ? childAccessor(item) : [];

            query.nodeLookup.set(item, result);

            if (childItems) {
                depth++;
                let previous: Node<T> | undefined;
                for (let i = 0; i < childItems.length; i++) {
                    const childItem = childItems[i],
                        child = createNode(childItem, result, previous, i);

                    children.push(child);

                    previous = child;
                }
                depth--;
            }

            return result;
        };

        query.rootNode = createNode(rootItem, undefined);

        return query;
    }

    private extend(iterator: () => IterableIterator<Node<T>>): Query<T> {
        const result = new Query<T>(iterator);
        result.rootNode = this.rootNode;
        result.nodeLookup = this.nodeLookup;
        return result;
    }

    public skip(count: number) {
        let iterator = this.iterate;
        return this.extend(function*() {
            let i = 0;
            for (let node of iterator()) {
                if (i >= count) {
                    yield node;
                }
                i++;
            }
        });
    }

    public take(count: number) {
        let iterator = this.iterate;
        return this.extend(function*() {
            let i = 0;
            for (let node of iterator()) {
                if (i >= count) {
                    break;
                }
                yield node;
                i++;
            }
        });
    }

    public whereNode(filter: (node: Node<T>) => boolean) {
        let iterator = this.iterate;
        return this.extend(function*() {
            for (let node of iterator()) {
                if (filter(node)) {
                    yield node;
                }
            }
        });
    }

    public hasDescendant(filter: (item: T) => boolean, excludeMatch: boolean = false) {
        return this.hasDescendantNode(n => filter(n.item), excludeMatch);
    }
    public hasDescendantNode(filter: (node: Node<T>) => boolean, excludeMatch: boolean = false) {
        const iterator = this.iterate,
            self = this;

        return this.extend(function*() {
            let matches = new Set<Node<T>>();
            for (let node of self.ascend()) {
                if (!matches.has(node) && filter(node)) {
                    if (!excludeMatch) {
                        matches.add(node);
                    }
                    for (let p of node.ancestors()) {
                        matches.add(p);
                    }
                }
            }

            for (let node of iterator()) {
                if (matches.has(node)) {
                    yield node;
                }
            }
        });
    }

    public count() {
        let result = 0;
        for (let node of this.iterate()) {
            result++;
        }
        return result;
    }

    public nth(n: number) {
        const result = this.skip(n)
            .take(1)
            .toArray()
            .find(() => true);
        return result;
    }

    public where(filter: (item: T) => boolean) {
        return this.whereNode(n => filter(n.item));
    }

    public ascend(from?: T, wrap?: boolean) {
        const node = (from && this.findNode(from)) || undefined;
        return this.extend(this.reverseIterator(node, wrap));
    }

    public descend(from?: T, wrap?: boolean) {
        const node = (from && this.findNode(from)) || undefined;
        return this.extend(this.forwardIterator(node, wrap));
    }

    public provideNext(provider: (current: Node<T>, defaultNext?: Node<T>) => undefined | Node<T>) {
        this.customMove = provider;
        return this;
    }

    public toArray() {
        const result = [];
        for (let item of this) {
            result.push(item);
        }
        return result;
    }

    public [Symbol.iterator](): Iterator<Node<T>> {
        return this.iterate();
    }

    public getRootNode() {
        return this.rootNode;
    }

    public findNode(item: T) {
        return this.nodeLookup.get(item);
    }

    private reverseIterator(from?: Node<T>, wrap?: boolean) {
        const self = this;
        return function*() {
            let start = from || self.rootNode.lastDescendant(),
                current: Node<T> | undefined = start;

            while (!!current) {
                if (!current.isRoot) {
                    yield current;
                }
                let next = current.reverseNode(wrap);
                current = self.customMove(current, next);
                if (current === start) {
                    break;
                }
            }
        };
    }

    private forwardIterator(from?: Node<T>, wrap?: boolean) {
        const self = this;
        return function*() {
            let start = from || self.rootNode,
                current: Node<T> | undefined = start;

            while (!!current) {
                if (!current.isRoot) {
                    yield current;
                }
                let next = current.forwardNode(wrap);
                current = self.customMove(current, next);
                if (current === start) {
                    break;
                }
            }
        };
    }
}

export class Node<T> {
    private _next?: Node<T>;
    private _children: Node<T>[];

    public get next() {
        return this._next;
    }
    public get children() {
        return this._children.slice();
    }
    public get isLastChild() {
        return !this.next;
    }
    public get isFirstChild() {
        return !this.prev;
    }
    public get isRoot() {
        return !this.parent;
    }
    public get firstChild(): Node<T> | undefined {
        return this.children[0];
    }
    public get lastChild(): Node<T> | undefined {
        return this.children[this.children.length - 1];
    }
    public ancestors(): IterableIterator<Node<T>> {
        const self = this;
        return (function*() {
            let current: Node<T> | undefined = self;
            while ((current = current.parent) !== undefined) {
                yield current;
            }
        })();
    }
    public getRoot() {
        let node: Node<T> | undefined = this;
        while (node && !node.isRoot) {
            node = node.parent;
        }
        return node;
    }
    public forwardNode(wrap?: boolean): Node<T> | undefined {
        let next: Node<T> | undefined = this.firstChild || this.next;

        if (!next) {
            for (let ancestor of this.ancestors()) {
                if (ancestor.next) {
                    next = ancestor.next;
                    break;
                } else if (ancestor.isRoot) {
                    next = ancestor;
                    break;
                }
            }
        }

        if (next && next.isRoot && !wrap) {
            next = undefined;
        }

        return next === this ? undefined : next;
    }

    public reverseNode(wrap?: boolean): Node<T> | undefined {
        let next: Node<T> | undefined = this.prev ? this.prev.lastDescendant() : this.parent;
        if (!next && wrap) {
            const root = this.getRoot();
            next = root ? root.lastDescendant() : undefined;
        }

        return next === this ? undefined : next;
    }

    public lastDescendant(): Node<T> | undefined {
        let result: Node<T> | undefined = this,
            current: Node<T> | undefined = this;
        while ((current = current.lastChild) !== undefined) {
            result = current;
        }
        return result;
    }

    constructor(
        public readonly prev: Node<T> | undefined,
        public readonly parent: Node<T> | undefined,
        public readonly depth: number,
        public readonly item: T,
        public readonly rootIndex: number,
        public readonly index: number,
        children: Node<T>[]
    ) {
        if (prev) {
            prev._next = this;
        }
        this._children = children;
    }
}
