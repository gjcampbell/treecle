import { SortedList, describeSortedList } from '../src/SortedList';
import Tree from '../demo/Tree';

test('stuff gets into the right structure', () => {
    const tree = SortedList.ofString();
    tree.add('aadf');
    tree.add('badf');
    tree.add('asdf');

    expect(tree.getSize()).toBe(3);
    expect(describeSortedList(tree)).toBe('asdf(aadf,badf)');
});

test('stuff added all at once acts normal', () => {
    const tree = SortedList.ofString();
    tree.add('aadf', 'badf', 'asdf');

    expect(tree.getSize()).toBe(3);
    expect(describeSortedList(tree)).toBe('asdf(aadf,badf)');
});

test('has the right bigger structure', () => {
    const tree = SortedList.ofNumber();
    tree.add(1, 2, 3, 4, 5, 6, 7);

    expect(tree.getSize()).toBe(7);
    expect(describeSortedList(tree)).toBe('4(2(1,3),6(5,7))');
});

test('looks good after a remove', () => {
    const tree = SortedList.ofNumber();
    tree.add(1, 2, 3, 4, 5, 6, 7);
    tree.remove(1);

    expect(tree.getSize()).toBe(6);
    expect(describeSortedList(tree)).toBe('4(2(-,3),6(5,7))');
});

test('looks good after a couple removes', () => {
    const tree = SortedList.ofNumber();
    tree.add(1, 2, 3, 4, 5, 6, 7);

    tree.remove(1, 2);
    expect(tree.getSize()).toBe(5);
    expect(describeSortedList(tree)).toBe('4(3,6(5,7))');

    tree.remove(3, 5);
    expect(tree.getSize()).toBe(3);
    expect(describeSortedList(tree)).toBe('6(4,7)');

    tree.remove(7);
    expect(tree.getSize()).toBe(2);
    expect(describeSortedList(tree)).toBe('6(4,-)');

    tree.remove(6);
    expect(tree.getSize()).toBe(1);
    expect(describeSortedList(tree)).toBe('4');

    tree.remove(4);
    expect(tree.getSize()).toBe(0);
    expect(describeSortedList(tree)).toBe('-');
    expect(tree.getRoot()).toBeUndefined();
});

test('can find stuff', () => {
    const tree = SortedList.ofNumber();
    tree.add(6, 1, 87, 23, 1, 9, 2, 4);

    const notThere = [...tree.find(5)];
    expect(notThere).toHaveLength(0);

    const there = [...tree.find(2)];
    expect(there).toHaveLength(1);
    expect(there[0]).toBe(2);
});

test('can add multiple same key non-primitives', () => {
    const tree = SortedList.ofType((a: { v: number }) => a.v);
    tree.add({ v: 1 }, { v: 1 });

    expect(tree.getSize()).toBe(2);

    expect(describeSortedList(tree)).toBe('1');
    expect(tree.getRoot()!.left).toBeUndefined();
    expect(tree.getRoot()!.right).toBeUndefined();
    expect([...tree.getItems()]).toHaveLength(2);
});

test('can find multiple non-primitives', () => {
    const tree = SortedList.ofTypeString((a: { id: string; name: string }) => a.id);
    tree.add({ id: 'a', name: '1' }, { id: 'a', name: '2' });
    const result = [...tree.find('a')],
        names = result.map(v => v.name);
    expect(names).toContain('1');
    expect(names).toContain('2');
});

test('can find one multiple non-primitives', () => {
    const tree = SortedList.ofTypeString((a: { id: string; name: string }) => a.id);
    tree.add({ id: 'a', name: '1' }, { id: 'a', name: '2' });

    const result = tree.findOne('a');
    expect(result).toBeTruthy();
    expect(['1', '2']).toContain(result!.name);
});

test('can remove non-primitives by reference', () => {
    const tree = SortedList.ofType((a: { v: number }) => a.v);
    const item1 = { v: 1 };
    tree.add(item1);
    tree.add({ v: 1 });

    tree.remove(item1);

    expect(tree.getSize()).toBe(1);
});

test('cannot remove objects not in tree', () => {
    const tree = SortedList.ofType((a: { v: number }) => a.v);
    tree.add({ v: 1 });

    expect(tree.getSize()).toBe(1);

    tree.remove({ v: 1 });

    expect(tree.getSize()).toBe(1);
});

test('can find all same-keyed non-primitives', () => {
    const tree = SortedList.ofType((a: { k: number; v?: string }) => a.k);
    tree.add({ k: 1 }, { k: 2 }, { k: 3, v: 'a' }, { k: 3, v: 'b' });

    const found = [...tree.find(3)];
    expect(found).toHaveLength(2);
    expect(found.map(o => o.v).indexOf('a')).toBeGreaterThanOrEqual(0);
    expect(found.map(o => o.v).indexOf('b')).toBeGreaterThanOrEqual(0);
});

test('can iterate items in order', () => {
    const tree = SortedList.ofNumber();
    tree.add(5, 1, 7, 2, 4, 6, 3);
    expect([...tree.getItems()].join(',')).toBe('1,2,3,4,5,6,7');

    tree.remove(1, 2);
    expect([...tree.getItems()].join(',')).toBe('3,4,5,6,7');

    tree.remove(6, 4);
    expect([...tree.getItems()].join(',')).toBe('3,5,7');

    tree.add(4, 6, 1, 2);
    expect([...tree.getItems()].join(',')).toBe('1,2,3,4,5,6,7');
});

test('has a reasonably log2(n) depth', () => {
    const tree = SortedList.ofNumber(),
        count = 10000;
    for (let i = 0; i < count; i++) {
        const item = Math.round(Math.random() * 100000);
        tree.add(item);
    }

    const getMaxDepth = (node: any, depth = 0): number => {
        const left = node ? getMaxDepth(node.left, depth + 1) : 0,
            right = node ? getMaxDepth(node.right, depth + 1) : 0;

        return Math.max(depth, left, right);
    };
    const maxDepth = getMaxDepth(tree.getRoot());
    expect(Math.abs(maxDepth - Math.log2(count))).toBeLessThanOrEqual(3);
});

test('can iterate in asc order', () => {
    const tree = SortedList.ofNumber();
    for (let i = 0; i < 1000; i++) {
        tree.add(Math.random() + i);
    }
    let prev = 0;
    for (let item of tree.getItems()) {
        if (item < prev) {
            fail();
        }
        prev = item;
    }
});

test('can iterate in desc order', () => {
    const tree = SortedList.ofNumber();
    for (let i = 0; i < 1000; i++) {
        tree.add(Math.random() + i);
    }
    let prev = 1001;
    for (let item of tree.getItems(true)) {
        if (item > prev) {
            fail();
        }
        prev = item;
    }
});

test('can remove the root', () => {
    const tree = SortedList.ofNumber();
    tree.add(5, 8, 2, 4, 1, 7, 6, 3, 9);
    tree.remove(5);

    expect(tree.getRoot()).toBeDefined();
    expect(tree.getRoot()!.getItem()).not.toEqual(5);
});

test('is correctly doubly linked', () => {
    const tree = SortedList.ofNumber(),
        validate = (expectedCount: number) => {
            let i = 1,
                prev = tree.getHead(),
                node = prev;
            while ((node = node!.next)) {
                expect(node.getItem()).toBeGreaterThan(prev!.getItem()!);
                expect(prev!.getItem()).toBeLessThan(prev!.next!.getItem()!);
                i++;

                prev = node;
            }
            expect(i).toBe(expectedCount);
        };

    tree.add(5, 8, 2, 4, 1, 7, 6, 3, 9);
    validate(9);

    tree.remove(5, 1, 9);
    validate(6);

    tree.add(5.1);
    validate(7);
});

test('can get range greater than', () => {
    const tree = SortedList.ofNumber();
    tree.add(10, 5, 3, 7, 1, 4, 2, 6, 8, 9);

    expect([...tree.getRange({ gt: 7 })].join('')).toEqual('8910');
    expect([...tree.getRange({ gte: 6 })].join('')).toEqual('678910');
});

test('can get range less than', () => {
    const tree = SortedList.ofNumber();
    tree.add(10, 5, 3, 7, 1, 4, 2, 6, 8, 9);

    expect([...tree.getRange({ lt: 4 })].join('')).toEqual('123');
    expect([...tree.getRange({ lte: 4 })].join('')).toEqual('1234');
});

test('can get range less than and greater than', () => {
    const tree = SortedList.ofNumber();
    tree.add(10, 5, 3, 7, 1, 4, 2, 6, 8, 9);

    expect([...tree.getRange({ lt: 5, gt: 1 })].join('')).toEqual('234');
    expect([...tree.getRange({ lte: 5, gte: 2 })].join('')).toEqual('2345');
    expect([...tree.getRange({ lte: 9, gt: 5 })].join('')).toEqual('6789');
    expect([...tree.getRange({ lt: 9, gte: 5 })].join('')).toEqual('5678');
    expect([...tree.getRange({ lt: 4, gt: 5 })].join('')).toEqual('');
});
