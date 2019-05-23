import * as React from 'react';

export enum Direction {
    NextSibling = 1,
    PrevSibling = 2,
    Parent = 4,
    Child = 8
}

export interface INode<T> {
    readonly depth: number;
    readonly hasChildren: boolean;
    readonly isLeaf: boolean;
    readonly isFirstChild: boolean;
    readonly isLastChild: boolean;
    readonly item: T;
    readonly parent: INode<T> | undefined;
    isExpanded: boolean;
    getChildren: () => INode<T[]> | undefined;
    get: (dir: Direction) => INode<T> | undefined;
    traverse: (dir: Direction, visitor: (node: INode<T>) => 'break' | void) => void;
    invalidate: (dir?: Direction, count?: number) => void;
}

export interface IConfig<ItemType, NodeType extends INode<ItemType>> {
    childAccessor: (item: ItemType) => ItemType[] | undefined;
    createNode: (item: ItemType) => NodeType;
}

export class NodeBase<T> implements INode<T> {
    protected children: INode<T>[] | null = null;
    private expanded: boolean = false;

    public get hasChildren() {
        const children = this.getChildren();
        return children !== undefined && children.length > 0;
    }
    public get isLeaf() {
        return this.getChildren() === undefined;
    }
    public get isExpanded() {
        return this.expanded;
    }
    public set isExpanded(value: boolean) {
        this.expanded = value;
    }

    constructor(
        private config: IConfig<T, INode<T>>,
        public readonly depth: number,
        public readonly isFirstChild: boolean,
        public readonly isLastChild: boolean,
        public readonly item: T,
        public readonly parent: INode<T> | undefined
    ) {}
    getChildren() {
        return this.children === null ? (this.children = this.createChildNodes()) : this.children;
    }
    get: (dir: Direction) => INode<T> | undefined;
    traverse: (dir: Direction, visitor: (node: INode<T>) => void | 'break') => void;
    invalidate(dir?: Direction, count: number = 1) {
        this.children = null;
        if (dir) {
            let i = 0,
                end = count === undefined ? 1 : count;
            this.traverse(dir, n => {
                n.invalidate();
                i++;
                if (i >= end) return 'break';
            });
        }
    }
    protected createChildNodes() {
        const nodes: NodeBase<T>[] = [];
        return nodes;
    }
}

interface ITreeProps<T> {
    childAccessor: (parent: T) => T[] | undefined;
    match?: (filter: string, item: T) => boolean;
}

export default class Tree<T> extends React.Component<ITreeProps<T>> {}
