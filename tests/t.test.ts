import { BTree, stringifyBtree } from '../src/AvlTree';

const createTree = () =>
    new BTree<string | number>((a, b) => {
        if (typeof a === 'string' && typeof a === 'string') return a > b ? 1 : a < b ? -1 : 0;
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        throw 'failed, fool';
    });

test('stuff gets into the right structure', () => {
    const tree = createTree();
    tree.add('aadf');
    tree.add('badf');
    tree.add('asdf');

    expect(tree.getSize()).toBe(3);
    expect(tree.getRoot()!.getOne()).toBe('asdf');
    expect(tree.getRoot()!.left!.getOne()).toBe('aadf');
    expect(tree.getRoot()!.right!.getOne()).toBe('badf');
});

test('stuff added all at once acts normal', () => {
    const tree = createTree();
    tree.add('aadf', 'badf', 'asdf');

    expect(tree.getSize()).toBe(3);
    expect(tree.getRoot()!.getOne()).toBe('asdf');
    expect(tree.getRoot()!.left!.getOne()).toBe('aadf');
    expect(tree.getRoot()!.right!.getOne()).toBe('badf');
});

test('has the right bigger structure', () => {
    const tree = createTree();
    tree.add(1, 2, 3, 4, 5, 6, 7);

    expect(tree.getSize()).toBe(7);
    expect(stringifyBtree(tree)).toBe('4(2(1(-,-),3(-,-)),6(5(-,-),7(-,-)))');
});

test('looks good after a remove', () => {
    const tree = createTree();
    tree.add(1, 2, 3, 4, 5, 6, 7);
    tree.remove(1);

    expect(tree.getSize()).toBe(6);
    expect(stringifyBtree(tree)).toBe('4(2(-,3(-,-)),6(5(-,-),7(-,-)))');
});

test('looks good after a couple removes', () => {
    const tree = createTree();
    tree.add(1, 2, 3, 4, 5, 6, 7);

    tree.remove(1, 2);
    expect(tree.getSize()).toBe(5);
    expect(stringifyBtree(tree)).toBe('4(3(-,-),6(5(-,-),7(-,-)))');

    tree.remove(3, 5);
    expect(tree.getSize()).toBe(3);
    expect(stringifyBtree(tree)).toBe('6(4(-,-),7(-,-))');

    tree.remove(7);
    expect(tree.getSize()).toBe(2);
    expect(stringifyBtree(tree)).toBe('6(4(-,-),-)');

    tree.remove(6);
    expect(tree.getSize()).toBe(1);
    expect(stringifyBtree(tree)).toBe('4(-,-)');

    tree.remove(4);
    expect(tree.getSize()).toBe(0);
    expect(stringifyBtree(tree)).toBe('-');
    expect(tree.getRoot()).toBeUndefined();
});

test('can find stuff', () => {
    const tree = createTree();
    tree.add(6, 1, 87, 23, 1, 9, 2, 4);

    const notThere = [...tree.find(5)];
    expect(notThere).toHaveLength(0);

    const there = [...tree.find(2)];
    expect(there).toHaveLength(1);
    expect(there[0]).toBe(2);
});

test('can add multiple same key non-primitives', () => {
    const tree = new BTree<{ v: number }>((a, b) => a.v - b.v);
    tree.add({ v: 1 }, { v: 1 });

    expect(tree.getSize()).toBe(2);

    expect(stringifyBtree(tree)).toBe('{"v":1}(-,-)');
});

test('can remove non-primitives by reference', () => {
    const tree = new BTree<{ v: number }>((a, b) => a.v - b.v);
    const item1 = { v: 1 };
    tree.add(item1);
    tree.add({ v: 1 });

    tree.remove(item1);

    expect(tree.getSize()).toBe(1);
});

test('cannot remove objects not in tree', () => {
    const tree = new BTree<{ v: number }>((a, b) => a.v - b.v);
    tree.add({ v: 1 });

    expect(tree.getSize()).toBe(1);

    tree.remove({ v: 1 });

    expect(tree.getSize()).toBe(1);
});

test('can find all same-keyed non-primitives', () => {
    const tree = new BTree<{ k: number; v?: string }>((a, b) => a.k - b.k);
    tree.add({ k: 1 }, { k: 2 }, { k: 3, v: 'a' }, { k: 3, v: 'b' });

    const found = [...tree.find({ k: 3 })];
    expect(found).toHaveLength(2);
    expect(found.map(o => o.v).indexOf('a')).toBeGreaterThanOrEqual(0);
    expect(found.map(o => o.v).indexOf('b')).toBeGreaterThanOrEqual(0);
});

test('can iterate items in order', () => {
    const tree = createTree();
    tree.add(5, 1, 7, 2, 4, 6, 3);
    expect([...tree.getItems()].join(',')).toBe('1,2,3,4,5,6,7');

    tree.remove(1, 2);
    expect([...tree.getItems()].join(',')).toBe('3,4,5,6,7');

    tree.remove(6, 4);
    expect([...tree.getItems()].join(',')).toBe('3,5,7');
});
