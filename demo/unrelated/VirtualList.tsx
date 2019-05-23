import * as React from 'react';
import { observable } from 'mobx';
import { observer } from 'mobx-react';
import styled from 'styled-components';

interface IVirtualListProps {
    itemSize: number;
    itemCount: number;
    height: number;
    children: (from: number, to: number) => React.ReactNode;
    style?: React.CSSProperties;
}

interface IViewerState {
    fullHeight: number;
    startIdx: number;
    length: number;
    topPadding: number;
}

@observer
export default class VirtualList extends React.Component<IVirtualListProps> {
    private container = React.createRef<HTMLDivElement>();

    @observable
    private viewerState!: IViewerState;

    render() {
        return (
            <Container
                ref={this.container}
                style={{ ...this.props.style }}
                height={this.props.height}
                onScroll={this.handleScroll}
            >
                {!this.viewerState ? null : this.renderBody()}
            </Container>
        );
    }
    renderBody() {
        const { fullHeight, startIdx, length, topPadding } = this.viewerState;

        return (
            <div style={{ height: fullHeight + 'px' }}>
                <div style={{ paddingTop: `${topPadding}px` }}>{this.props.children(startIdx, length)}</div>
            </div>
        );
    }
    renderPadding(height: number) {
        return <div style={{ height: height + 'px' }} />;
    }
    componentDidMount() {
        this.updateViewerState();
    }
    componentDidUpdate(prevProps: IVirtualListProps) {
        if (
            prevProps.itemSize !== this.props.itemSize ||
            prevProps.itemCount !== this.props.itemCount ||
            prevProps.height !== this.props.height
        ) {
            this.updateViewerState();
        }
    }
    private handleScroll = () => {
        this.updateViewerState();
    };
    private updateViewerState() {
        const vPos = this.container.current ? this.container.current.scrollTop : 0,
            { itemSize, itemCount, height } = this.props,
            fullHeight = Math.max(1, itemCount * itemSize),
            startIdx = Math.floor((vPos / fullHeight) * itemCount),
            length = Math.min(Math.ceil(height / itemSize) + 1, itemCount - startIdx),
            topPadding = startIdx * itemSize,
            viewerState: IViewerState = {
                fullHeight,
                startIdx,
                length,
                topPadding
            };

        this.viewerState = viewerState;
    }
}

const Container = styled.div<{ height: number }>`
    overflow: auto;
    height: ${p => p.height}px;
`;
