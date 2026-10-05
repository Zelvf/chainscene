"use client";

import { useMemo } from "react";
import { ReactFlow, Background, Controls, Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Investigation } from "@/lib/types";

function short(value: string) { return `${value.slice(0, 5)}…${value.slice(-5)}`; }

function AccountNode({ data }: NodeProps<Node<{ label: string; subtitle: string; active: boolean }>>) {
  return <div className={`flow-account ${data.active ? "flow-account-active" : ""}`}>
    <Handle type="target" position={Position.Left} />
    <span className="flow-account-icon">◈</span>
    <div><strong>{data.label}</strong><small>{data.subtitle}</small></div>
    <Handle type="source" position={Position.Right} />
  </div>;
}

const nodeTypes = { account: AccountNode };

export function FlowMap({ result, selectedTransfer, onSelectAddress, onSelectTransfer }: {
  result: Investigation;
  selectedTransfer: string | null;
  onSelectAddress: (address: string) => void;
  onSelectTransfer: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const addresses = [...new Set(result.transfers.flatMap((transfer) => [transfer.sourceOwner || transfer.source, transfer.destinationOwner || transfer.destination]))].slice(0, 12);
    const nodeList: Node[] = addresses.map((address, index) => {
      const isSource = result.transfers.some((transfer) => (transfer.sourceOwner || transfer.source) === address);
      const column = isSource ? 0 : 1;
      const row = addresses.slice(0, index).filter((earlier) => result.transfers.some((transfer) => (column === 0 ? (transfer.sourceOwner || transfer.source) : (transfer.destinationOwner || transfer.destination)) === earlier)).length;
      return { id: address, type: "account", position: { x: column * 370, y: row * 126 }, data: { label: short(address), subtitle: isSource ? "Source account" : "Destination account", active: result.transfers.some((transfer) => transfer.id === selectedTransfer && (transfer.sourceOwner || transfer.source) === address) } };
    });
    const edgeList: Edge[] = result.transfers.filter((transfer) => addresses.includes(transfer.sourceOwner || transfer.source) && addresses.includes(transfer.destinationOwner || transfer.destination)).map((transfer) => ({
      id: transfer.id,
      source: transfer.sourceOwner || transfer.source,
      target: transfer.destinationOwner || transfer.destination,
      label: transfer.mint ? "TOKEN" : "SOL",
      animated: transfer.id === selectedTransfer,
      markerEnd: { type: MarkerType.ArrowClosed, color: transfer.id === selectedTransfer ? "#abff5f" : "#6b7b76" },
      style: { stroke: transfer.id === selectedTransfer ? "#abff5f" : "#6b7b76", strokeWidth: transfer.id === selectedTransfer ? 2.5 : 1.5 },
      labelStyle: { fill: "#d8e0db", fontSize: 11, fontWeight: 700 },
      labelBgStyle: { fill: "#17231d" },
    }));
    return { nodes: nodeList, edges: edgeList };
  }, [result, selectedTransfer]);

  if (!nodes.length) return <div className="empty-map"><span>◇</span><strong>No decoded transfers in this transaction</strong><p>Balance changes and program calls are still available below.</p></div>;

  return <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.25} maxZoom={1.7} onNodeClick={(_, node: Node) => onSelectAddress(node.id)} onEdgeClick={(_, edge: Edge) => onSelectTransfer(edge.id)}>
    <Background color="#2c3a31" gap={24} size={1} />
    <Controls showInteractive={false} />
  </ReactFlow>;
}
