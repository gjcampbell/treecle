import * as React from 'react';
import { SortedList } from '../../src/SortedList';
import VirtualList from '../unrelated/VirtualList';
import styled from 'styled-components';
import { Typography } from '@material-ui/core';

export default function SortedListDemo() {
    const list = SortedList.ofNumber(),
        itemSize = 25;
    let items: number[] = [];
    for (let i = 0; i < 10000; i++) {
        list.add(Math.random());
    }
    items = [...list.getItems()];

    return (
        <VirtualList height={500} style={{ width: '300px' }} itemCount={items.length} itemSize={itemSize}>
            {(from, length) => {
                const rows = items.slice(from, from + length);

                return rows.map((item, i) => (
                    <Item key={i} height={itemSize}>
                        <Typography>{item}</Typography>
                    </Item>
                ));
            }}
        </VirtualList>
    );
}
const Item = styled.div<{ height: number }>`
    height: ${p => p.height}px;
    padding: 0 9px;
    border-bottom: solid 1px #0003;
    p {
        line-height: ${p => p.height}px;
    }
`;
