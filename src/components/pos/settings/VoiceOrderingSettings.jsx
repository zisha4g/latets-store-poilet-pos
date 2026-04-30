import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dagre from '@dagrejs/dagre';
import {
  ReactFlow,
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext.jsx';
import {
  FileCode2,
  Maximize2,
  Minimize2,
  PencilLine,
  Phone,
  RefreshCw,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';

// NODE META
const NODE_TYPE_META = {
  gather:  { label: 'Gather Digits',    color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', icon: '🔢' },
  message: { label: 'Play Message',     color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', icon: '💬' },
  record:  { label: 'Record Voice',     color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', icon: '🎙️' },
  branch:  { label: 'Branch Menu',      color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', icon: '🔀' },
  payment: { label: 'Payment Handoff',  color: '#ec4899', bg: '#fdf2f8', border: '#f9a8d4', icon: '💳' },
  end:     { label: 'End Call',         color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', icon: '🔚' },
};

const EDGE_CONDITION_OPTIONS = [
  { value: 'always',   label: 'Always' },
  { value: 'digit',    label: 'Digit pressed' },
  { value: 'any',      label: 'Any input' },
  { value: 'recorded', label: 'Recording received' },
];

// UTILS
const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
const canonicalStorePhone = (v) => { const d = digitsOnly(v); if (d.length === 11 && d.startsWith('1')) return d.slice(1); return d.slice(0,10); };
const formatDisplayPhone = (v) => { const d = canonicalStorePhone(v); if (!d) return ''; if (d.length<=3) return d; if (d.length<=6) return `(${d.slice(0,3)})-${d.slice(3)}`; return `(${d.slice(0,3)})-${d.slice(3,6)}-${d.slice(6,10)}`; };
const makeId = (p) => `${p}_${Math.random().toString(36).slice(2,8)}_${Date.now().toString(36).slice(-4)}`;
const serializeFlow = (f) => JSON.stringify(f, null, 2);

// DEFAULT FLOW
const createDefaultGraphFlow = () => {
  const nodes = [
    {
      id: 'n_item',
      type: 'gather',
      title: 'Enter Item Number',
      prompt: 'Welcome! Please enter the item number you would like to order, then press pound.',
      captureVar: 'item_number',
      finishOnKey: '#',
    },
    {
      id: 'n_qty',
      type: 'gather',
      title: 'Enter Quantity',
      prompt: 'Please enter the quantity for this item, then press pound.',
      captureVar: 'item_qty',
      finishOnKey: '#',
    },
    {
      id: 'n_item_added',
      type: 'message',
      title: 'Item Added',
      prompt: 'Great! Your item has been found and added to your cart.',
    },
    {
      id: 'n_cart_menu',
      type: 'branch',
      title: 'Cart Menu',
      prompt: 'To add another item dial 1. To proceed to checkout dial 2. To hear the items in your cart dial 3.',
      captureVar: 'cart_choice',
      maxDigits: 1,
    },
    {
      id: 'n_hear_cart',
      type: 'message',
      title: 'Hear Cart',
      prompt: 'Returning to cart menu.',
    },
    {
      id: 'n_confirm_callback',
      type: 'branch',
      title: 'Confirm Callback Number',
      prompt: 'Is the best callback number the number you are calling from? Press 1 for yes. Press 2 for no.',
      captureVar: 'callback_confirmed',
      maxDigits: 1,
    },
    {
      id: 'n_get_phone',
      type: 'gather',
      title: 'Enter Phone Number',
      prompt: 'Please enter your 10-digit telephone number.',
      captureVar: 'customer_phone',
      maxDigits: 10,
    },
    {
      id: 'n_address_menu',
      type: 'branch',
      title: 'Address Menu',
      prompt: 'Press 1 to use your saved address, or press 2 to enter a new address.',
      captureVar: 'address_choice',
      maxDigits: 1,
    },
    {
      id: 'n_street_number',
      type: 'gather',
      title: 'Enter Street Number',
      prompt: 'Please enter your street number, then press pound.',
      captureVar: 'street_number',
      finishOnKey: '#',
    },
    {
      id: 'n_street_name',
      type: 'record',
      title: 'Record Street Name',
      prompt: 'Please say and spell your street name after the tone.',
      captureVar: 'street_name_recording',
    },
    {
      id: 'n_unit_menu',
      type: 'branch',
      title: 'Unit Number Menu',
      prompt: 'If you have a unit or apartment number, dial 1. If not, dial 2.',
      captureVar: 'unit_choice',
      maxDigits: 1,
    },
    {
      id: 'n_unit_number',
      type: 'gather',
      title: 'Enter Unit Number',
      prompt: 'Please enter your unit number, then press pound.',
      captureVar: 'unit_number',
      finishOnKey: '#',
    },
    {
      id: 'n_zip_code',
      type: 'gather',
      title: 'Enter Zip Code',
      prompt: 'Please enter your zip code.',
      captureVar: 'delivery_zip',
      maxDigits: 5,
    },
    {
      id: 'n_instructions_menu',
      type: 'branch',
      title: 'Delivery Instructions Menu',
      prompt: 'If you have delivery instructions, dial 1. If not, dial 2.',
      captureVar: 'instructions_choice',
      maxDigits: 1,
    },
    {
      id: 'n_instructions_record',
      type: 'record',
      title: 'Record Instructions',
      prompt: 'Please record your delivery instructions after the tone.',
      captureVar: 'delivery_instructions_recording',
    },
    {
      id: 'n_get_cc',
      type: 'gather',
      title: 'Enter Card Number',
      prompt: 'Please enter your 16-digit credit card number.',
      captureVar: 'cc_number',
      maxDigits: 16,
    },
    {
      id: 'n_get_expiry',
      type: 'gather',
      title: 'Enter Expiration Date',
      prompt: 'Please enter your card expiration date as 4 digits, month then year.',
      captureVar: 'cc_expiry',
      maxDigits: 4,
    },
    {
      id: 'n_get_cvv',
      type: 'gather',
      title: 'Enter Security Code',
      prompt: 'Please enter your 3 or 4 digit security code.',
      captureVar: 'cc_cvv',
      maxDigits: 4,
    },
    {
      id: 'n_get_billing_zip',
      type: 'gather',
      title: 'Enter Billing Zip',
      prompt: 'Please enter your billing zip code.',
      captureVar: 'cc_billing_zip',
      maxDigits: 5,
    },
    {
      id: 'n_order_menu',
      type: 'branch',
      title: 'Place Order Menu',
      prompt: 'To place your order dial 1. To return to your cart dial 2.',
      captureVar: 'order_choice',
      maxDigits: 1,
    },
    {
      id: 'n_process',
      type: 'payment',
      title: 'Process Order',
      prompt: 'Please hold while we process your payment.',
    },
    {
      id: 'n_payment_failed',
      type: 'branch',
      title: 'Payment Failed Menu',
      prompt: 'Your payment did not go through. To try your card again, dial 1. To return to your cart, dial 2.',
      captureVar: 'payment_retry_choice',
      maxDigits: 1,
    },
    {
      id: 'n_end',
      type: 'end',
      title: 'Order Confirmed',
      prompt: 'Your payment went through. You should receive your order in the next 24 hours. Thank you for ordering!',
    },
  ];
  const edges = [
    { id:'e1',  from:'n_item',            to:'n_qty',           conditionType:'any',      conditionValue:'' },
    { id:'e2',  from:'n_qty',             to:'n_item_added',    conditionType:'any',      conditionValue:'' },
    { id:'e3',  from:'n_item_added',      to:'n_cart_menu',     conditionType:'always',   conditionValue:'' },
    { id:'e4',  from:'n_cart_menu',       to:'n_item',          conditionType:'digit',    conditionValue:'1' },
    { id:'e5',  from:'n_cart_menu',       to:'n_confirm_callback', conditionType:'digit',    conditionValue:'2' },
    { id:'e6',  from:'n_cart_menu',       to:'n_hear_cart',     conditionType:'digit',    conditionValue:'3' },
    { id:'e7',  from:'n_hear_cart',       to:'n_cart_menu',     conditionType:'always',   conditionValue:'' },
    { id:'e7b', from:'n_confirm_callback', to:'n_address_menu',      conditionType:'digit',    conditionValue:'1' },
    { id:'e7c', from:'n_confirm_callback', to:'n_get_phone',           conditionType:'digit',    conditionValue:'2' },
    { id:'e8',  from:'n_get_phone',         to:'n_address_menu',      conditionType:'any',      conditionValue:'' },
    { id:'e8c', from:'n_get_phone',         to:'n_street_number',     conditionType:'digit',    conditionValue:'new_customer' },
    { id:'e8a', from:'n_address_menu',      to:'n_get_cc',             conditionType:'digit',    conditionValue:'1' },
    { id:'e8b', from:'n_address_menu',      to:'n_street_number',      conditionType:'digit',    conditionValue:'2' },
    { id:'e9',  from:'n_street_number',     to:'n_street_name',        conditionType:'any',      conditionValue:'' },
    { id:'e10', from:'n_street_name',       to:'n_unit_menu',          conditionType:'recorded', conditionValue:'' },
    { id:'e11', from:'n_unit_menu',         to:'n_unit_number',        conditionType:'digit',    conditionValue:'1' },
    { id:'e12', from:'n_unit_menu',         to:'n_zip_code',           conditionType:'digit',    conditionValue:'2' },
    { id:'e13', from:'n_unit_number',       to:'n_zip_code',           conditionType:'any',      conditionValue:'' },
    { id:'e14', from:'n_zip_code',          to:'n_instructions_menu',  conditionType:'any',      conditionValue:'' },
    { id:'e15', from:'n_instructions_menu', to:'n_instructions_record',conditionType:'digit',    conditionValue:'1' },
    { id:'e16', from:'n_instructions_menu', to:'n_get_cc',             conditionType:'digit',    conditionValue:'2' },
    { id:'e17', from:'n_instructions_record',to:'n_get_cc',            conditionType:'recorded', conditionValue:'' },
    { id:'e18', from:'n_get_cc',            to:'n_get_expiry',         conditionType:'any',      conditionValue:'' },
    { id:'e19', from:'n_get_expiry',        to:'n_get_cvv',            conditionType:'any',      conditionValue:'' },
    { id:'e20', from:'n_get_cvv',           to:'n_get_billing_zip',    conditionType:'any',      conditionValue:'' },
    { id:'e21', from:'n_get_billing_zip',   to:'n_order_menu',         conditionType:'any',      conditionValue:'' },
    { id:'e22', from:'n_order_menu',        to:'n_process',            conditionType:'digit',    conditionValue:'1' },
    { id:'e23', from:'n_order_menu',        to:'n_cart_menu',          conditionType:'digit',    conditionValue:'2' },
    { id:'e24', from:'n_process',           to:'n_end',                conditionType:'always',   conditionValue:'' },
    { id:'e25', from:'n_payment_failed',    to:'n_get_cc',             conditionType:'digit',    conditionValue:'1' },
    { id:'e26', from:'n_payment_failed',    to:'n_cart_menu',          conditionType:'digit',    conditionValue:'2' },
    { id:'e27', from:'n_process',           to:'n_payment_failed',     conditionType:'digit',    conditionValue:'9' },
  ];
  return { mode:'graph', version:1, startNodeId:'n_item', nodes, edges };
};

const isGraphFlow = (f) => !!f && f.mode==='graph' && Array.isArray(f.nodes) && Array.isArray(f.edges);

const toGraphFlow = (flow) => {
  if (isGraphFlow(flow)) return flow;
  return createDefaultGraphFlow();
};

const validateGraph = (flow) => {
  const errors = [];
  if (!isGraphFlow(flow)) { errors.push('Flow must be graph mode.'); return errors; }
  if (!flow.nodes.length) errors.push('Add at least one node.');
  if (!flow.startNodeId) errors.push('Start node not set.');
  const nodeIds = new Set(flow.nodes.map((n) => n.id));
  if (flow.startNodeId && !nodeIds.has(flow.startNodeId)) errors.push('Start node does not exist.');
  flow.nodes.forEach((node) => {
    if (!node.title?.trim()) errors.push(`Node ${node.id} missing title.`);
    if (!node.prompt?.trim()) errors.push(`Node "${node.title||node.id}" needs a prompt.`);
    if (node.type!=='end' && !flow.edges.some((e)=>e.from===node.id)) errors.push(`Node "${node.title||node.id}" has no outgoing path.`);
  });
  flow.edges.forEach((edge) => {
    if (!nodeIds.has(edge.from)||!nodeIds.has(edge.to)) errors.push('Edge references a missing node.');
    if (edge.conditionType==='digit'&&!String(edge.conditionValue||'').trim()) errors.push('Digit edge missing digit value.');
  });
  return [...new Set(errors)];
};

// RF CONVERSION
const NODE_W = 156, NODE_H = 70;

// Detect back-edges (cycles) via DFS so dagre only receives a DAG.
// Returns a Set of edge ids that form back-edges.
const detectBackEdgeIds = (rfNodes, rfEdges) => {
  const adj = {};
  rfNodes.forEach((n) => { adj[n.id] = []; });
  rfEdges.forEach((e) => { if (adj[e.source]) adj[e.source].push({ id: e.id, target: e.target }); });
  const visited = new Set();
  const inStack = new Set();
  const backIds = new Set();
  const dfs = (nodeId) => {
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const { id, target } of (adj[nodeId] || [])) {
      if (inStack.has(target)) { backIds.add(id); }
      else if (!visited.has(target)) { dfs(target); }
    }
    inStack.delete(nodeId);
  };
  rfNodes.forEach((n) => { if (!visited.has(n.id)) dfs(n.id); });
  return backIds;
};

const getLayoutedElements = (rfNodes, rfEdges) => {
  const backIds = detectBackEdgeIds(rfNodes, rfEdges);
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 38, ranksep: 54, edgesep: 14, marginx: 8, marginy: 8 });
  rfNodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  rfEdges.forEach((e) => {
    if (!backIds.has(e.id)) { try { g.setEdge(e.source, e.target); } catch {} }
  });
  dagre.layout(g);
  return {
    nodes: rfNodes.map((n) => {
      const pos = g.node(n.id);
      return { ...n, position: pos ? { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } : n.position };
    }),
    edges: rfEdges.map((e) => ({
      ...e,
      data: { ...e.data, isBackEdge: backIds.has(e.id) },
    })),
  };
};

const graphToRfNodes = (gf) => gf.nodes.map((node) => ({
  id: node.id, type:'ivrNode',
  position: node._pos || { x: 0, y: 0 },
  data: { ...node, isStart: node.id===gf.startNodeId },
  selected: false,
}));

const edgeLabel = (e) => { if(e.conditionType==='always')return ''; if(e.conditionType==='digit')return `press ${e.conditionValue}`; if(e.conditionType==='any')return 'any'; if(e.conditionType==='recorded')return 'recorded'; return ''; };

const DIGIT_COLORS = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#f97316'];
const getEdgeColor = (edge, allEdges) => {
  if (edge.conditionType === 'always') return '#64748b';
  if (edge.conditionType === 'any') return '#8b5cf6';
  if (edge.conditionType === 'recorded') return '#f59e0b';
  if (edge.conditionType === 'digit') {
    const siblings = allEdges.filter((e) => e.from === edge.from && e.conditionType === 'digit')
      .sort((a, b) => String(a.conditionValue).localeCompare(String(b.conditionValue)));
    const idx = siblings.findIndex((e) => e.id === edge.id);
    return DIGIT_COLORS[idx % DIGIT_COLORS.length];
  }
  return '#94a3b8';
};

const getEdgeLabelLanes = (edges) => {
  const bySource = new Map();
  edges.forEach((edge) => {
    const bucket = bySource.get(edge.from) || [];
    bucket.push(edge);
    bySource.set(edge.from, bucket);
  });

  const laneById = new Map();
  bySource.forEach((bucket) => {
    const sorted = [...bucket].sort((a, b) => {
      const av = `${a.conditionType || ''}:${a.conditionValue || ''}:${a.from}:${a.id}`;
      const bv = `${b.conditionType || ''}:${b.conditionValue || ''}:${b.from}:${b.id}`;
      return av.localeCompare(bv);
    });
    const center = (sorted.length - 1) / 2;
    sorted.forEach((edge, idx) => {
      laneById.set(edge.id, idx - center);
    });
  });

  return laneById;
};

const graphToRfEdges = (gf) => {
  const laneById = getEdgeLabelLanes(gf.edges);
  return gf.edges.map((edge) => {
  const color = getEdgeColor(edge, gf.edges);
  return {
    id: edge.id, source: edge.from, target: edge.to, type:'ivrEdge',
    markerEnd: { type: MarkerType.ArrowClosed, color },
    style: { stroke: color, strokeWidth: 2.5 },
    data: { conditionType: edge.conditionType, conditionValue: edge.conditionValue, displayLabel: edgeLabel(edge), shortLabel: edgeLabel(edge).replace('press ', ''), bendPoint: edge.bendPoint || null, color, labelLane: laneById.get(edge.id) ?? 0 },
  };
  });
};

const rfToGraph = (rfNodes, rfEdges, gf) => ({
  ...gf,
  nodes: rfNodes.map((n) => ({ ...n.data, id:n.id, _pos:n.position, isStart:undefined })),
  edges: rfEdges.map((e) => ({ id:e.id, from:e.source, to:e.target, conditionType:e.data?.conditionType||'always', conditionValue:e.data?.conditionValue||'', bendPoint: e.data?.bendPoint || null })),
});

const getDefaultBendPoint = (sourceX, sourceY, targetX, targetY) => ({
  x: (sourceX + targetX) / 2,
  y: (sourceY + targetY) / 2,
});

const getSourceLabelPosition = (sourceX, sourceY, toX, toY, lane = 0) => {
  const dx = toX - sourceX;
  const dy = toY - sourceY;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const pushForward = 26;
  const sideOffset = 14 * lane;
  return {
    x: sourceX + ux * pushForward + nx * sideOffset,
    y: sourceY + uy * pushForward + ny * sideOffset,
  };
};

const getRoutedEdgePath = (sourceX, sourceY, targetX, targetY, bendPoint, lane = 0) => {
  const point = bendPoint || getDefaultBendPoint(sourceX, sourceY, targetX, targetY);
  const label = getSourceLabelPosition(sourceX, sourceY, point.x, point.y, lane);
  return {
    bendPoint: point,
    path: `M ${sourceX} ${sourceY} L ${point.x} ${point.y} L ${targetX} ${targetY}`,
    labelX: label.x,
    labelY: label.y,
  };
};

// Back-edge: a smooth C-curve sweeping to the LEFT of the canvas so it
// visually "returns up" without crossing any forward-flow nodes.
const getBackEdgePath = (sourceX, sourceY, targetX, targetY, lane = -2) => {
  const sweep = Math.max(120, Math.abs(sourceY - targetY) * 0.55);
  const leftX = Math.min(sourceX, targetX) - sweep;
  const label = getSourceLabelPosition(sourceX, sourceY, leftX, sourceY, lane);
  return {
    path: `M ${sourceX} ${sourceY} C ${leftX} ${sourceY} ${leftX} ${targetY} ${targetX} ${targetY}`,
    labelX: label.x,
    labelY: label.y,
  };
};

const IvrEdge = ({ id, sourceX, sourceY, targetX, targetY, markerEnd, style, selected, data }) => {
  const { screenToFlowPosition, setEdges } = useReactFlow();
  const isDragging = React.useRef(false);
  const isBack = !!data?.isBackEdge;
  const lane = Number(data?.labelLane ?? 0);
  const color = data?.color || style?.stroke || '#94a3b8';
  const strokeWidth = selected ? 3.5 : 2.5;
  const strokeColor = selected ? '#1e293b' : color;

  // Back-edge: fixed arc, no bend handle needed
  if (isBack) {
    const { path, labelX, labelY } = getBackEdgePath(sourceX, sourceY, targetX, targetY, lane - 2);
    return (
      <>
        <BaseEdge id={id} path={path} markerEnd={markerEnd}
          style={{ stroke: strokeColor, strokeWidth, strokeDasharray: '7 4' }} />
        <EdgeLabelRenderer>
          {!!data?.displayLabel && (
            <div
              className="nodrag nopan rounded-full border bg-background px-1.5 py-0 text-[10px] font-semibold shadow-sm"
              style={{ position:'absolute', transform:`translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents:'all', color, borderColor: color, zIndex: 40 }}
            >
              {data.shortLabel || data.displayLabel}
            </div>
          )}
        </EdgeLabelRenderer>
      </>
    );
  }

  // Forward edge: bent line with draggable midpoint handle
  const { path, bendPoint, labelX, labelY } = getRoutedEdgePath(sourceX, sourceY, targetX, targetY, data?.bendPoint, lane);

  const applyBend = React.useCallback((point) => {
    setEdges((eds) => eds.map((e) => e.id === id ? { ...e, data: { ...e.data, bendPoint: point } } : e));
  }, [id, setEdges]);

  const onPointerDownHandle = React.useCallback((event) => {
    event.stopPropagation();
    isDragging.current = true;
    const onMove = (mv) => {
      if (!isDragging.current) return;
      const pt = screenToFlowPosition({ x: mv.clientX, y: mv.clientY });
      applyBend(pt);
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [applyBend, screenToFlowPosition]);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ ...style, strokeWidth, stroke: strokeColor }} />
      <EdgeLabelRenderer>
        {!!data?.displayLabel && (
          <div
            className="nodrag nopan rounded-full border bg-background px-1.5 py-0 text-[10px] font-semibold shadow-sm"
            style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all', color, borderColor: color, zIndex: 40 }}
          >
            {data.shortLabel || data.displayLabel}
          </div>
        )}
      </EdgeLabelRenderer>
      {selected && (
        <>
          <circle cx={bendPoint.x} cy={bendPoint.y} r={9} fill="#ffffff" stroke={color} strokeWidth={2} style={{ cursor: 'grab' }} onPointerDown={onPointerDownHandle} />
          <circle cx={bendPoint.x} cy={bendPoint.y} r={3.5} fill={color} style={{ pointerEvents: 'none' }} />
        </>
      )}
    </>
  );
};

// CUSTOM NODE
const IvrNode = ({ data, selected }) => {
  const meta = NODE_TYPE_META[data.type] || NODE_TYPE_META.message;
  return (
    <div style={{ background: '#fff', border:`1.5px solid ${selected ? meta.color : meta.border}`, borderRadius:10, width:NODE_W, minWidth:NODE_W, boxShadow: selected ? `0 0 0 2px ${meta.color}22` : '0 1px 2px rgba(15,23,42,0.08)', padding:'7px 9px 8px', cursor:'pointer', transition:'all 0.15s' }}>
      <Handle type="target" position={Position.Top} style={{ background:meta.color, border:'2px solid #fff', width:8, height:8, top:-5 }} />
      <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:3, minWidth:0 }}>
        {data.isStart && <span style={{ fontSize:8, background:meta.color, color:'#fff', borderRadius:999, padding:'1px 4px', fontWeight:700, lineHeight:1.2 }}>START</span>}
        <span style={{ fontSize:10, color:meta.color, fontWeight:700, textTransform:'uppercase', letterSpacing:0.35, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{meta.label}</span>
      </div>
      <div style={{ fontWeight:700, fontSize:12, color:'#0f172a', marginBottom:data.prompt ? 2 : 0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{data.title||'Untitled'}</div>
      {data.prompt && <div style={{ fontSize:10, color:'#64748b', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.25 }}>{data.prompt}</div>}
      <Handle type="source" position={Position.Bottom} style={{ background:meta.color, border:'2px solid #fff', width:8, height:8, bottom:-5 }} />
    </div>
  );
};
const nodeTypes = { ivrNode: IvrNode };
const edgeTypes = { ivrEdge: IvrEdge };

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN-ENGLISH LABELS
// ─────────────────────────────────────────────────────────────────────────────
const FRIENDLY_TYPE = {
  gather:  { label: 'Ask a Question',       icon: '❓', color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', desc: 'Collect number input from the caller' },
  message: { label: 'Play a Message',       icon: '💬', color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', desc: 'Say something and automatically continue' },
  record:  { label: 'Record Voice',         icon: '🎙️', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', desc: 'Record what the caller says' },
  branch:  { label: 'Phone Menu',           icon: '🔀', color: '#10b981', bg: '#ecfdf5', border: '#6ee7b7', desc: 'Let caller press 1, 2, 3... to choose' },
  payment: { label: 'Take Payment',         icon: '💳', color: '#ec4899', bg: '#fdf2f8', border: '#f9a8d4', desc: 'Collect card details and process payment' },
  end:     { label: 'End the Call',         icon: '📞', color: '#6b7280', bg: '#f9fafb', border: '#d1d5db', desc: 'Say goodbye and hang up' },
};

// Hardcoded runtime conditions in voice-webhook (keyed by node.id).
// These are NOT digit-press branches — they evaluate caller data (customer record, saved address, etc.)
// and either skip the step or modify the prompt before playing it.
const NODE_RUNTIME_CONDITION = {
  n_address_menu: {
    badge: 'Smart step',
    title: 'Only runs if the caller has a saved address',
    body: 'When the call reaches this step, the system checks the customer record. If a saved address is on file, this menu plays with "We have your address on file as: …" added to the message. If no saved address is on file, this whole step is skipped and the call goes straight to "Enter Address".',
  },
};

// Build a BFS-ordered display list from graph (forward edges only).
// Returns array of node objects in traversal order.
const buildDisplayOrder = (gf) => {
  if (!isGraphFlow(gf) || !gf.startNodeId) return [];
  const backIds = detectBackEdgeIds(
    gf.nodes.map((n) => ({ id: n.id })),
    gf.edges.map((e) => ({ id: e.id, source: e.from, target: e.to })),
  );
  const forwardEdges = gf.edges.filter((e) => !backIds.has(e.id));
  const adj = {};
  gf.nodes.forEach((n) => { adj[n.id] = []; });
  forwardEdges.forEach((e) => { if (adj[e.from]) adj[e.from].push(e.to); });
  const seen = new Set();
  const order = [];
  const queue = [gf.startNodeId];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const node = gf.nodes.find((n) => n.id === id);
    if (node) order.push(node);
    (adj[id] || []).forEach((child) => { if (!seen.has(child)) queue.push(child); });
  }
  // append any nodes not reachable (disconnected)
  gf.nodes.forEach((n) => { if (!seen.has(n.id)) order.push(n); });
  return order;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADD STEP MODAL
// ─────────────────────────────────────────────────────────────────────────────
const AddStepModal = ({ open, onClose, onAdd, insertAfterId, allNodes }) => {
  const [step, setStep] = useState(null); // null = pick type, or type string
  const [title, setTitle] = useState('');
  const [gotoId, setGotoId] = useState('');

  useEffect(() => {
    if (open) { setStep(null); setTitle(''); setGotoId(''); }
  }, [open]);

  if (!open) return null;
  const successorId = (() => {
    if (!insertAfterId) return null;
    // find next node in display order
    const idx = allNodes.findIndex((n) => n.id === insertAfterId);
    return idx >= 0 && idx < allNodes.length - 1 ? allNodes[idx + 1].id : null;
  })();

  const handleAdd = () => {
    if (!step) return;
    const ft = FRIENDLY_TYPE[step];
    const newNode = {
      id: makeId('node'),
      type: step,
      title: title.trim() || ft.label,
      prompt: step === 'end' ? 'Thank you for calling. Goodbye!' : 'Edit this message.',
      captureVar: (step === 'gather' || step === 'branch') ? 'input_value' : undefined,
      finishOnKey: step === 'gather' ? '#' : undefined,
      maxDigits: step === 'branch' ? 1 : undefined,
    };
    onAdd({ newNode, insertAfterId, successorId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="font-semibold text-base">{step ? 'Configure new step' : 'Add a New Step'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        {!step ? (
          <div className="p-5 grid grid-cols-2 gap-3">
            {Object.entries(FRIENDLY_TYPE).map(([type, ft]) => (
              <button
                key={type}
                onClick={() => setStep(type)}
                className="flex flex-col items-start gap-1.5 rounded-xl border-2 p-4 text-left hover:border-primary transition-colors"
                style={{ borderColor: ft.border, background: ft.bg }}
              >
                <span className="text-2xl">{ft.icon}</span>
                <span className="font-semibold text-sm" style={{ color: ft.color }}>{ft.label}</span>
                <span className="text-xs text-muted-foreground">{ft.desc}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border p-3" style={{ background: FRIENDLY_TYPE[step].bg, borderColor: FRIENDLY_TYPE[step].border }}>
              <span className="text-2xl">{FRIENDLY_TYPE[step].icon}</span>
              <div>
                <p className="font-semibold text-sm" style={{ color: FRIENDLY_TYPE[step].color }}>{FRIENDLY_TYPE[step].label}</p>
                <p className="text-xs text-muted-foreground">{FRIENDLY_TYPE[step].desc}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Step name</label>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 bg-background"
                placeholder={FRIENDLY_TYPE[step].label}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">You can edit the message and settings after adding.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setStep(null)} className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-muted transition-colors">Back</button>
              <button onClick={handleAdd} className="flex-1 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors">Add Step</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE STEP CARD
// ─────────────────────────────────────────────────────────────────────────────
const StepCard = ({
  node, stepNumber, isStart, isLast, allNodes, allEdges,
  onUpdate, onDelete, onAddAfter,
  isDragging, onDragStart, onDragOver, onDrop, onDragEnd,
}) => {
  const [expanded, setExpanded] = useState(false);
  const ft = FRIENDLY_TYPE[node.type] || FRIENDLY_TYPE.message;
  const runtimeCond = NODE_RUNTIME_CONDITION[node.id] || null;

  const outEdges = allEdges.filter((e) => e.from === node.id);
  const optionEdges = outEdges.filter((e) => e.conditionType === 'digit').sort((a, b) => String(a.conditionValue).localeCompare(String(b.conditionValue)));
  const otherEdges = outEdges.filter((e) => e.conditionType !== 'digit');

  const nodeTitle = (id) => {
    const n = allNodes.find((x) => x.id === id);
    if (!n) return '—';
    return `${FRIENDLY_TYPE[n.type]?.icon || '•'} ${n.title}`;
  };

  const handleOptionDigitChange = (edgeId, digit) => onUpdate(node.id, { __edgePatch: { edgeId, patch: { conditionValue: digit } } });
  const handleOptionGotoChange  = (edgeId, toId) => onUpdate(node.id, { __edgePatch: { edgeId, patch: { to: toId } } });
  const handleDeleteOption      = (edgeId)       => onUpdate(node.id, { __deleteEdge: edgeId });
  const handleAddOption         = ()             => onUpdate(node.id, { __addEdge: { from: node.id, conditionType: 'digit', conditionValue: '', to: '' } });
  const handleGotoChange        = (edgeId, toId) => onUpdate(node.id, { __edgePatch: { edgeId, patch: { to: toId } } });

  // Build collapsed "goes to" chips for branch nodes
  const branchChips = optionEdges.map((e) => ({
    digit: e.conditionValue,
    label: nodeTitle(e.to),
    id: e.id,
  }));

  const singleGoto = (node.type !== 'branch' && outEdges.length > 0) ? nodeTitle(outEdges[0].to) : null;

  return (
    <div
      className={`flex gap-0 transition-opacity ${isDragging ? 'opacity-40' : 'opacity-100'}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Left gutter: step number + connector line */}
      <div className="flex flex-col items-center w-10 shrink-0 pt-3">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 z-10"
          style={{ background: ft.color }}
        >
          {isStart ? '▶' : stepNumber}
        </div>
        {!isLast && (
          <div className="flex-1 w-0.5 mt-1" style={{ background: `${ft.color}40`, minHeight: 24 }} />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 mb-1 min-w-0">
        <div
          className={`rounded-xl border-2 bg-background transition-all`}
          style={{
            borderColor: expanded ? ft.color : ft.border,
            boxShadow: expanded ? `0 0 0 3px ${ft.color}14` : '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          {/* Header row */}
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            {/* Drag handle */}
            <span
              className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 text-base leading-none"
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
            >⠿</span>

            {/* Type icon */}
            <span className="text-lg shrink-0">{ft.icon}</span>

            {/* Title + type badge */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm truncate">{node.title || 'Untitled'}</span>
                <span
                  className="text-[11px] rounded-full px-2 py-0.5 font-medium shrink-0 whitespace-nowrap"
                  style={{ color: ft.color, background: ft.bg, border: `1px solid ${ft.border}` }}
                >{ft.label}</span>
                {runtimeCond && (
                  <span
                    className="text-[11px] rounded-full px-2 py-0.5 font-medium shrink-0 whitespace-nowrap inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-300"
                    title={runtimeCond.title}
                  >🔍 {runtimeCond.badge}</span>
                )}
              </div>

              {/* Collapsed preview */}
              {!expanded && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate leading-snug">{node.prompt || '—'}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {!isStart && (
                <button
                  onClick={() => { if (window.confirm(`Delete "${node.title}"?`)) onDelete(node.id); }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete this step"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              )}
              <span className="text-muted-foreground text-xs px-1">{expanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Collapsed "goes to" footer */}
          {!expanded && node.type !== 'end' && (
            <div className="px-3 pb-2.5 flex items-center gap-2 flex-wrap">
              {node.type === 'branch' && branchChips.length > 0 ? (
                branchChips.map((chip) => (
                  <span key={chip.id} className="inline-flex items-center gap-1 text-[11px] rounded-full border px-2 py-0.5 bg-muted/30">
                    <span className="font-bold" style={{ color: ft.color }}>Press {chip.digit}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="truncate max-w-[120px]">{chip.label}</span>
                  </span>
                ))
              ) : singleGoto ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="font-medium" style={{ color: ft.color }}>→</span>
                  <span>{singleGoto}</span>
                </span>
              ) : (
                <span className="text-[11px] text-red-400 italic">⚠ No next step connected</span>
              )}
            </div>
          )}

          {/* Expanded edit form */}
          {expanded && (
            <div className="border-t px-4 pb-5 pt-4 space-y-4" style={{ borderColor: ft.border }}>

              {/* Runtime condition notice (hardcoded smart behavior) */}
              {runtimeCond && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-3 flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5">🔍</span>
                  <div className="flex-1 space-y-1">
                    <div className="text-sm font-bold text-amber-900">{runtimeCond.title}</div>
                    <p className="text-xs text-amber-800 leading-relaxed">{runtimeCond.body}</p>
                    <p className="text-[11px] text-amber-700 italic mt-1">This behavior is built into the system and cannot be edited from this screen.</p>
                  </div>
                </div>
              )}

              {/* Step Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Step Name</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ focusRingColor: ft.color }}
                  value={node.title || ''}
                  onChange={(e) => onUpdate(node.id, { title: e.target.value })}
                />
              </div>

              {/* Prompt / message */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {node.type === 'end' ? 'Goodbye Message' : node.type === 'record' ? 'Recording Prompt' : '🔊 Message the Caller Hears'}
                </label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2.5 text-sm bg-background outline-none focus:ring-2 resize-none leading-relaxed"
                  rows={3}
                  value={node.prompt || ''}
                  onChange={(e) => onUpdate(node.id, { prompt: e.target.value })}
                />
              </div>

              {/* Gather-specific fields */}
              {node.type === 'gather' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Max Digits</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2"
                      value={node.maxDigits || ''}
                      onChange={(e) => { const n = parseInt(e.target.value, 10); onUpdate(node.id, { maxDigits: isNaN(n) ? null : n }); }}
                      placeholder="Any"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Key (e.g. #)</label>
                    <input
                      className="w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2"
                      value={node.finishOnKey || ''}
                      onChange={(e) => onUpdate(node.id, { finishOnKey: e.target.value || null })}
                      placeholder="#"
                    />
                  </div>
                </div>
              )}

              {/* Single "goes to" for gather / message / record / payment */}
              {(node.type === 'gather' && otherEdges.length > 0) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">After collecting input → go to</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2"
                    value={otherEdges[0].to || ''}
                    onChange={(e) => handleGotoChange(otherEdges[0].id, e.target.value)}
                  >
                    <option value="">— Select next step —</option>
                    {allNodes.filter((n) => n.id !== node.id).map((n) => (
                      <option key={n.id} value={n.id}>{FRIENDLY_TYPE[n.type]?.icon || '•'} {n.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {(node.type === 'message' || node.type === 'record' || node.type === 'payment') && outEdges.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Then → go to</label>
                  <select
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-background outline-none focus:ring-2"
                    value={outEdges[0].to || ''}
                    onChange={(e) => handleGotoChange(outEdges[0].id, e.target.value)}
                  >
                    <option value="">— Select next step —</option>
                    {allNodes.filter((n) => n.id !== node.id).map((n) => (
                      <option key={n.id} value={n.id}>{FRIENDLY_TYPE[n.type]?.icon || '•'} {n.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Branch options — caller picks a digit from a phone menu */}
              {node.type === 'branch' && (
                <div className="space-y-2.5">
                  <div className="rounded-xl border bg-muted/30 px-3 py-2.5 flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">📞</span>
                    <div className="flex-1 text-xs leading-relaxed">
                      <span className="font-semibold" style={{ color: ft.color }}>Phone menu — </span>
                      <span className="text-muted-foreground">the caller hears the message above and presses a key. The call routes to a different step depending on which key they press.</span>
                    </div>
                  </div>

                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">Menu choices</label>

                  {optionEdges.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1">No choices yet. Add one below.</p>
                  )}

                  <div className="space-y-2">
                    {optionEdges.map((edge, i) => (
                      <div key={edge.id} className="flex items-center gap-2 rounded-xl border p-3 bg-background">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: ft.color }}
                        >{i + 1}</div>
                        <span className="text-xs text-muted-foreground shrink-0">Press</span>
                        <input
                          className="w-10 rounded-md border px-1.5 py-1 text-sm text-center font-bold bg-background outline-none focus:ring-2"
                          value={edge.conditionValue || ''}
                          maxLength={2}
                          onChange={(e) => handleOptionDigitChange(edge.id, e.target.value)}
                          placeholder="1"
                        />
                        <span className="text-xs text-muted-foreground shrink-0">→ Go to</span>
                        <select
                          className="flex-1 rounded-md border px-2 py-1.5 text-sm bg-background outline-none focus:ring-2 min-w-0"
                          value={edge.to || ''}
                          onChange={(e) => handleOptionGotoChange(edge.id, e.target.value)}
                        >
                          <option value="">— Select step —</option>
                          {allNodes.filter((n) => n.id !== node.id).map((n) => (
                            <option key={n.id} value={n.id}>{FRIENDLY_TYPE[n.type]?.icon || '•'} {n.title}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleDeleteOption(edge.id)}
                          className="text-muted-foreground hover:text-red-500 shrink-0 p-1 rounded-md hover:bg-red-50 transition-colors"
                          title="Remove choice"
                        >✕</button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleAddOption}
                    className="flex items-center justify-center gap-1.5 text-xs font-semibold rounded-xl border-2 border-dashed px-3 py-2.5 w-full hover:bg-muted/30 transition-colors"
                    style={{ borderColor: ft.border, color: ft.color }}
                  >+ Add another choice</button>

                  {otherEdges.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs text-muted-foreground font-medium">If caller presses anything else, or stays silent →</label>
                      {otherEdges.map((edge) => (
                        <div key={edge.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">Fallback →</span>
                          <select
                            className="flex-1 rounded-md border px-2 py-1.5 text-sm bg-background outline-none focus:ring-2"
                            value={edge.to || ''}
                            onChange={(e) => handleGotoChange(edge.id, e.target.value)}
                          >
                            <option value="">— None —</option>
                            {allNodes.filter((n) => n.id !== node.id).map((n) => (
                              <option key={n.id} value={n.id}>{FRIENDLY_TYPE[n.type]?.icon || '•'} {n.title}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* "Add step here"ctor — shown between cards */}
        {!isLast && (
          <div className="flex items-center gap-2 py-1 pl-1 group">
            <button
              onClick={() => onAddAfter(node.id)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 rounded-full border border-dashed px-3 py-1 hover:border-primary hover:text-primary transition-all"
            >+ Insert step here</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// FLOW LIST EDITOR — main end-user component
// ─────────────────────────────────────────────────────────────────────────────
const FlowListEditor = ({ graphFlow, syncGraph, flowPublished, flowVersion, saveFlowDraft, publishFlow, resetToDefault, channelPhone, channelEnabled, adminMode, flowsList = [], selectedFlowId, onSelectFlow, onCreateFlow, onRenameFlow, onDeleteFlow, onSetPrimary, onToggleActive }) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [insertAfterId, setInsertAfterId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { nodeId, nodeTitle }
  const [dragState, setDragState] = useState(null); // { draggingId, overIndex }

  const displayNodes = useMemo(() => buildDisplayOrder(graphFlow), [graphFlow]);

  // ── Patch helpers ──────────────────────────────────────────────────────────
  const patchGraph = useCallback((fn) => {
    syncGraph(fn(graphFlow));
  }, [graphFlow, syncGraph]);

  const handleUpdate = useCallback((nodeId, patch) => {
    patchGraph((gf) => {
      let newNodes = gf.nodes;
      let newEdges = gf.edges;

      if (patch.__edgePatch) {
        // patch an edge
        const { edgeId, patch: ep } = patch.__edgePatch;
        newEdges = gf.edges.map((e) => e.id === edgeId ? { ...e, ...ep } : e);
      } else if (patch.__deleteEdge) {
        newEdges = gf.edges.filter((e) => e.id !== patch.__deleteEdge);
      } else if (patch.__addEdge) {
        newEdges = [...gf.edges, { id: makeId('edge'), ...patch.__addEdge }];
      } else {
        // patch node fields
        newNodes = gf.nodes.map((n) => n.id === nodeId ? { ...n, ...patch } : n);
      }

      return { ...gf, nodes: newNodes, edges: newEdges };
    });
  }, [patchGraph]);

  const handleDelete = useCallback((nodeId) => {
    patchGraph((gf) => {
      if (gf.nodes.length <= 1) return gf; // can't delete last node
      const inEdges = gf.edges.filter((e) => e.to === nodeId);
      const outEdges = gf.edges.filter((e) => e.from === nodeId);

      let newEdges = gf.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

      // Auto-reconnect: if exactly 1 in and 1 out, reconnect
      if (inEdges.length === 1 && outEdges.length === 1) {
        newEdges = [...newEdges, {
          id: makeId('edge'), from: inEdges[0].from, to: outEdges[0].to,
          conditionType: inEdges[0].conditionType, conditionValue: inEdges[0].conditionValue,
        }];
      }

      const newNodes = gf.nodes.filter((n) => n.id !== nodeId);
      const newStart = gf.startNodeId === nodeId ? (newNodes[0]?.id || '') : gf.startNodeId;
      return { ...gf, nodes: newNodes, edges: newEdges, startNodeId: newStart };
    });
  }, [patchGraph]);

  const handleAdd = useCallback(({ newNode, insertAfterId: afterId, successorId }) => {
    patchGraph((gf) => {
      const newNodes = [...gf.nodes, newNode];
      let newEdges = [...gf.edges];

      if (afterId) {
        // If there's a direct edge from afterId → successorId, replace it
        if (successorId) {
          const existingEdge = newEdges.find((e) => e.from === afterId && e.to === successorId);
          if (existingEdge) {
            newEdges = newEdges.filter((e) => e.id !== existingEdge.id);
            newEdges.push({ id: makeId('edge'), from: afterId, to: newNode.id, conditionType: existingEdge.conditionType, conditionValue: existingEdge.conditionValue });
            newEdges.push({ id: makeId('edge'), from: newNode.id, to: successorId, conditionType: 'always', conditionValue: '' });
          } else {
            newEdges.push({ id: makeId('edge'), from: afterId, to: newNode.id, conditionType: 'always', conditionValue: '' });
          }
        } else {
          newEdges.push({ id: makeId('edge'), from: afterId, to: newNode.id, conditionType: 'always', conditionValue: '' });
        }
      }

      const newStart = gf.nodes.length === 0 ? newNode.id : gf.startNodeId;
      return { ...gf, nodes: newNodes, edges: newEdges, startNodeId: newStart };
    });
  }, [patchGraph]);

  // ── Drag-to-reorder (HTML5) ────────────────────────────────────────────────
  const dragNode = useRef(null);
  const dragOverIndex = useRef(null);

  const handleDragStart = (nodeId) => { dragNode.current = nodeId; };
  const handleDragOver = (e, index) => { e.preventDefault(); dragOverIndex.current = index; };
  const handleDrop = () => {
    if (!dragNode.current || dragOverIndex.current === null) return;
    const fromIndex = displayNodes.findIndex((n) => n.id === dragNode.current);
    const toIndex = dragOverIndex.current;
    if (fromIndex === toIndex || fromIndex < 0) { dragNode.current = null; return; }

    // Swap in linear sequence: find the edges connecting these two and rewire
    patchGraph((gf) => {
      // Build new node order in graph
      const newOrder = [...displayNodes];
      const [moved] = newOrder.splice(fromIndex, 1);
      newOrder.splice(toIndex, 0, moved);

      // Rebuild linear forward edges to match new order
      // Only rewire edges where both endpoints are in the linear sequence
      const newNodes = [...gf.nodes];

      // Build set of IDs in display order
      const seqIds = newOrder.map((n) => n.id);
      const newEdges = gf.edges.filter((e) => {
        // Remove edges between consecutive display nodes that are changing
        const fi = seqIds.indexOf(e.from);
        const ti = seqIds.indexOf(e.to);
        if (fi >= 0 && ti >= 0 && Math.abs(fi - ti) === 1) return false;
        if (fi >= 0 && ti >= 0 && fi < ti) return false;
        return true;
      });

      // Add new sequential edges
      for (let i = 0; i < seqIds.length - 1; i++) {
        newEdges.push({ id: makeId('edge'), from: seqIds[i], to: seqIds[i + 1], conditionType: 'always', conditionValue: '' });
      }

      return { ...gf, nodes: newNodes, edges: newEdges, startNodeId: newOrder[0]?.id || gf.startNodeId };
    });
    dragNode.current = null;
    dragOverIndex.current = null;
  };

  const openAdd = (afterId) => { setInsertAfterId(afterId); setAddModalOpen(true); };

  const validationErrors = useMemo(() => validateGraph(graphFlow), [graphFlow]);

  return (
    <div className="space-y-4">
      {/* Flow picker — choose which flow to edit, manage all flows */}
      <div className="rounded-xl border bg-background px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Editing flow:</span>
          <select
            className="flex-1 min-w-[200px] rounded-lg border px-3 py-2 text-sm font-semibold bg-background outline-none focus:ring-2"
            value={selectedFlowId || ''}
            onChange={(e) => onSelectFlow?.(e.target.value)}
          >
            {(flowsList || []).length === 0 && <option value="">— No flows yet —</option>}
            {(flowsList || []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.is_primary ? '⭐ ' : ''}{f.name}{!f.is_active ? ' (off)' : ''}{!f.published ? ' (draft)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={onCreateFlow}
            className="text-sm rounded-lg border px-3 py-2 hover:bg-muted transition-colors font-medium"
            title="Create a new flow"
          >+ New flow</button>
          {selectedFlowId && (
            <>
              <button
                onClick={onRenameFlow}
                className="text-sm rounded-lg border px-3 py-2 hover:bg-muted transition-colors text-muted-foreground"
                title="Rename this flow"
              >✏️ Rename</button>
              {(() => {
                const cur = (flowsList || []).find((f) => f.id === selectedFlowId);
                if (!cur) return null;
                return (
                  <>
                    {!cur.is_primary && (
                      <button
                        onClick={onSetPrimary}
                        className="text-sm rounded-lg border px-3 py-2 hover:bg-muted transition-colors text-amber-600 border-amber-300"
                        title="Make this the primary flow that incoming phone calls trigger"
                      >⭐ Make primary</button>
                    )}
                    <button
                      onClick={() => onToggleActive?.(cur.id, !cur.is_active)}
                      className={`text-sm rounded-lg border px-3 py-2 transition-colors ${cur.is_active ? 'text-green-700 border-green-300 hover:bg-green-50' : 'text-gray-500 hover:bg-muted'}`}
                      title={cur.is_active ? 'Disable this flow' : 'Enable this flow'}
                    >{cur.is_active ? '🟢 Active' : '⚪ Off'}</button>
                    {!cur.is_primary && (
                      <button
                        onClick={onDeleteFlow}
                        className="text-sm rounded-lg border px-2.5 py-2 hover:bg-red-50 transition-colors text-red-500 border-red-200"
                        title="Delete this flow"
                      >🗑</button>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
        {(() => {
          const cur = (flowsList || []).find((f) => f.id === selectedFlowId);
          if (!cur) return null;
          return (
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {cur.is_primary
                ? <><span className="text-amber-600 font-semibold">⭐ Primary flow</span> — phone calls to your number trigger this flow.</>
                : <>This flow is not primary. It will not run on incoming calls{cur.is_active ? ', but other flows can route into it once that feature is enabled.' : '.'}</>}
            </p>
          );
        })()}
      </div>

      {/* Top info bar — phone number + status */}
      <div className="rounded-xl border bg-muted/20 px-4 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-base">📞</span>
            <span className="font-semibold text-sm">{channelPhone ? formatDisplayPhone(channelPhone) : 'No phone assigned'}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${channelEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {channelEnabled ? 'Voice ordering ON' : 'Voice ordering OFF'}
            </span>
          </div>
          {adminMode && (
            <span className="text-xs rounded-full px-2.5 py-0.5 bg-purple-100 text-purple-700 font-medium">Admin</span>
          )}
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Phone Call Flow</span>
            <span className={`text-xs rounded-full px-2.5 py-1 font-semibold ${flowPublished ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {flowPublished ? '✓ Published' : '○ Draft'}
            </span>
            {flowVersion && <span className="text-xs text-muted-foreground">v{flowVersion}</span>}
            {validationErrors.length > 0 && (
              <span className="text-xs rounded-full px-2.5 py-1 font-semibold bg-red-100 text-red-600">{validationErrors.length} issue(s)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefault}
              className="text-xs rounded-lg border px-3 py-1.5 hover:bg-muted transition-colors text-muted-foreground"
              title="Reset to default template"
            >Reset to default</button>
            <button
              onClick={saveFlowDraft}
              className="text-sm rounded-lg border px-4 py-1.5 hover:bg-muted transition-colors font-medium"
            >Save Draft</button>
            <button
              onClick={publishFlow}
              className="text-sm rounded-lg px-4 py-1.5 font-semibold text-white transition-colors"
              style={{ background: validationErrors.length > 0 ? '#94a3b8' : '#22c55e' }}
              disabled={validationErrors.length > 0}
            >🚀 Go Live</button>
          </div>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-semibold text-red-600 mb-1">Fix these issues before going live:</p>
          <ul className="text-xs text-red-500 space-y-0.5">{validationErrors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
        </div>
      )}

      {/* Step list */}
      <div>
        {/* Add before first */}
        <div className="flex items-center gap-3 pl-4 mb-1">
          <div className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground shrink-0 text-xs">+</div>
          <button
            onClick={() => openAdd(null)}
            className="text-xs text-muted-foreground hover:text-primary rounded-full border-dashed border px-3 py-1 transition-colors hover:border-primary"
          >Add step at start</button>
        </div>

        {displayNodes.map((node, index) => (
          <StepCard
            key={node.id}
            node={node}
            stepNumber={index + 1}
            isStart={node.id === graphFlow.startNodeId}
            isLast={index === displayNodes.length - 1}
            allNodes={graphFlow.nodes}
            allEdges={graphFlow.edges}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAddAfter={openAdd}
            isDragging={dragNode.current === node.id}
            onDragStart={() => handleDragStart(node.id)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={handleDrop}
            onDragEnd={() => { dragNode.current = null; }}
          />
        ))}

        {displayNodes.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed p-10 text-center text-muted-foreground space-y-3 ml-10">
            <p className="text-4xl">📞</p>
            <p className="font-medium">No steps yet</p>
            <p className="text-sm">Add your first step to start building the call flow.</p>
          </div>
        )}

        {/* Add at end button */}
        {displayNodes.length > 0 && (
          <div className="flex items-center gap-3 pl-4 mt-1">
            <div className="w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-muted-foreground shrink-0 text-xs">+</div>
            <button
              onClick={() => openAdd(displayNodes[displayNodes.length - 1]?.id ?? null)}
              className="text-xs text-muted-foreground hover:text-primary rounded-full border-dashed border px-3 py-1 transition-colors hover:border-primary"
            >Add step at end</button>
          </div>
        )}
      </div>

      <AddStepModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAdd}
        insertAfterId={insertAfterId}
        allNodes={displayNodes}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const VoiceOrderingSettings = () => {
  const { user, loading: authLoading } = useAuth();

  const [loadingUserConfig, setLoadingUserConfig] = useState(true);
  const [channelEnabled, setChannelEnabled] = useState(false);
  const [channelPhone, setChannelPhone] = useState('');
  const [flowVersion, setFlowVersion] = useState(null);
  const [flowPublished, setFlowPublished] = useState(false);
  const [publishedFlow, setPublishedFlow] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);

  // Multi-flow support
  const [flowsList, setFlowsList] = useState([]); // [{id,name,version,published,is_active,is_primary,updated_at}]
  const [selectedFlowId, setSelectedFlowId] = useState(null);

  const [graphFlow, setGraphFlow] = useState(createDefaultGraphFlow);
  const [flowJson, setFlowJson] = useState(() => serializeFlow(createDefaultGraphFlow()));
  const [validationErrors, setValidationErrors] = useState([]);
  const [showJson, setShowJson] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState([]);

  const [selNode, setSelNode] = useState(null);
  const [selEdge, setSelEdge] = useState(null);

  const [voiceSettings, setVoiceSettings] = useState({ allow_out_of_stock: true, restrict_products: false, allowed_product_ids: [] });
  const [voiceProducts, setVoiceProducts] = useState([]);
  const [voiceCategories, setVoiceCategories] = useState([]);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [voicePickerCategory, setVoicePickerCategory] = useState('all');
  const [voicePickerQuery, setVoicePickerQuery] = useState('');
  const [savingVoiceSettings, setSavingVoiceSettings] = useState(false);

  const [adminMode, setAdminMode] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignPhone, setAssignPhone] = useState('');
  const [assignProviderAccountId, setAssignProviderAccountId] = useState('');
  const [assignWebhookSecret, setAssignWebhookSecret] = useState('');
  const [assignEnabled, setAssignEnabled] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const builderRootRef = React.useRef(null);
  const [activeTab, setActiveTab] = useState('editor'); // 'editor' | 'settings' | 'advanced'

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedUserId) || null, [users, selectedUserId]);
  const flowModeLabel = flowPublished ? 'Published' : 'Draft';

  const allowedProductIds = useMemo(
    () => new Set((voiceSettings.allowed_product_ids || []).map((id) => String(id))),
    [voiceSettings.allowed_product_ids],
  );

  const productsByCategory = useMemo(() => {
    const namesById = new Map((voiceCategories || []).map((c) => [String(c.id), String(c.name || 'Uncategorized')]));
    const grouped = new Map();
    (voiceProducts || []).forEach((product) => {
      const categoryId = String(product.category_id || 'uncategorized');
      const categoryName = namesById.get(categoryId) || (categoryId === 'uncategorized' ? 'Uncategorized' : 'Other');
      const key = `${categoryId}::${categoryName}`;
      const list = grouped.get(key) || [];
      list.push(product);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries())
      .map(([key, products]) => {
        const [id, name] = key.split('::');
        const sortedProducts = [...products].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
        return { id, name, products: sortedProducts };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [voiceCategories, voiceProducts]);

  const filteredCategoryGroups = useMemo(() => {
    const q = (voicePickerQuery || '').trim().toLowerCase();
    return productsByCategory
      .filter((group) => voicePickerCategory === 'all' || group.id === voicePickerCategory)
      .map((group) => {
        const products = q
          ? group.products.filter((p) =>
              String(p.name || '').toLowerCase().includes(q) ||
              String(p.sku || '').toLowerCase().includes(q) ||
              String(p.barcode || '').toLowerCase().includes(q),
            )
          : group.products;
        return { ...group, products };
      })
      .filter((group) => group.products.length > 0);
  }, [productsByCategory, voicePickerCategory, voicePickerQuery]);

  const pushToRf = useCallback((gf) => {
    const rawNodes = graphToRfNodes(gf);
    const rawEdges = graphToRfEdges(gf);
    const hasPositions = gf.nodes.some((n) => n._pos);
    if (hasPositions) {
      setRfNodes(rawNodes);
      setRfEdges(rawEdges);
    } else {
      const { nodes, edges } = getLayoutedElements(rawNodes, rawEdges);
      setRfNodes(nodes);
      setRfEdges(edges);
    }
  }, [setRfNodes, setRfEdges]);

  const runAutoLayout = useCallback(() => {
    setRfNodes((nds) => {
      setRfEdges((eds) => {
        const { nodes, edges } = getLayoutedElements(nds, eds);
        setTimeout(() => { setRfNodes(nodes); setRfEdges(edges); }, 0);
        return eds;
      });
      return nds;
    });
  }, [setRfNodes, setRfEdges]);

  const toggleFullscreen = useCallback(async () => {
    const element = builderRootRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await element.requestFullscreen();
      }
    } catch {
      // Keep builder usable even if browser fullscreen is unavailable.
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const syncGraph = useCallback((nextGraph) => {
    setGraphFlow(nextGraph);
    setFlowJson(serializeFlow(nextGraph));
    setValidationErrors(validateGraph(nextGraph));
    pushToRf(nextGraph);
  }, [pushToRf]);

  const loadUserConfig = useCallback(async (flowIdOverride) => {
    setLoadingUserConfig(true);
    // Fetch flow list and the active/selected flow in parallel.
    const [{ data: listData }, { data, error }] = await Promise.all([
      supabase.functions.invoke('voice-config', { body: { action: 'list_flows' } }),
      supabase.functions.invoke('voice-config', { body: { action: 'get', flowId: flowIdOverride || undefined } }),
    ]);
    if (error || !data?.ok) { toast({ title:'Voice settings load failed', description:error?.message||data?.error, variant:'destructive' }); setLoadingUserConfig(false); return; }
    if (listData?.ok) setFlowsList(listData.flows || []);
    setChannelEnabled(!!data.channel?.voice_ordering_enabled);
    setChannelPhone(data.channel?.inbound_phone_e164 || '');
    setFlowVersion(data.config?.version ?? null);
    setFlowPublished(!!data.config?.published);
    setSelectedFlowId(data.config?.id ?? null);
    const nextGraph = toGraphFlow(data.config?.flow || null);
    setPublishedFlow(nextGraph);
    syncGraph(nextGraph);
    if (data.config?.voice_settings) {
      setVoiceSettings({ allow_out_of_stock: true, restrict_products: false, allowed_product_ids: [], ...data.config.voice_settings });
    }
    // Load products for picker
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, sku, barcode, stock, category_id')
        .eq('user_id', u.id)
        .order('name');
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('user_id', u.id)
        .order('name');
      setVoiceProducts(prods || []);
      setVoiceCategories(cats || []);
    }
    setLoadingUserConfig(false);
  }, [syncGraph]);

  const saveVoiceSettings = useCallback(async () => {
    setSavingVoiceSettings(true);
    const { error } = await supabase.functions.invoke('voice-config', { body: { action: 'save_voice_settings', voiceSettings, flowId: selectedFlowId || undefined } });
    setSavingVoiceSettings(false);
    if (error) {
      toast({ title: 'Failed to save settings', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Voice settings saved' });
  }, [voiceSettings, selectedFlowId]);

  // ─── Multi-flow management ───
  const refreshFlowsList = useCallback(async () => {
    const { data } = await supabase.functions.invoke('voice-config', { body: { action: 'list_flows' } });
    if (data?.ok) setFlowsList(data.flows || []);
  }, []);

  const selectFlow = useCallback(async (flowId) => {
    if (!flowId || flowId === selectedFlowId) return;
    if (hasUnsavedChangesRef.current?.()) {
      if (!window.confirm('You have unsaved changes in the current flow. Switch anyway and lose them?')) return;
    }
    await loadUserConfig(flowId);
  }, [selectedFlowId, loadUserConfig]);

  const createNewFlow = useCallback(async () => {
    const name = window.prompt('Name for the new flow:', 'New flow');
    if (!name || !name.trim()) return;
    const { data, error } = await supabase.functions.invoke('voice-config', { body: { action: 'create_flow', name: name.trim() } });
    if (error || !data?.ok) { toast({ title: 'Create failed', description: error?.message || data?.error, variant: 'destructive' }); return; }
    toast({ title: `Created "${data.flow.name}"` });
    await loadUserConfig(data.flow.id);
  }, [loadUserConfig]);

  const renameCurrentFlow = useCallback(async () => {
    if (!selectedFlowId) return;
    const current = flowsList.find((f) => f.id === selectedFlowId);
    const next = window.prompt('New flow name:', current?.name || '');
    if (!next || !next.trim() || next.trim() === current?.name) return;
    const { error, data } = await supabase.functions.invoke('voice-config', { body: { action: 'rename_flow', flowId: selectedFlowId, name: next.trim() } });
    if (error || !data?.ok) { toast({ title: 'Rename failed', description: error?.message || data?.error, variant: 'destructive' }); return; }
    toast({ title: 'Flow renamed' });
    refreshFlowsList();
  }, [selectedFlowId, flowsList, refreshFlowsList]);

  const deleteCurrentFlow = useCallback(async () => {
    if (!selectedFlowId) return;
    const current = flowsList.find((f) => f.id === selectedFlowId);
    if (current?.is_primary) { toast({ title: 'Cannot delete the primary flow. Make another flow primary first.', variant: 'destructive' }); return; }
    if (!window.confirm(`Delete flow "${current?.name}"? This cannot be undone.`)) return;
    const { error, data } = await supabase.functions.invoke('voice-config', { body: { action: 'delete_flow', flowId: selectedFlowId } });
    if (error || !data?.ok) { toast({ title: 'Delete failed', description: error?.message || data?.error, variant: 'destructive' }); return; }
    toast({ title: 'Flow deleted' });
    // Switch to primary
    const list = flowsList.filter((f) => f.id !== selectedFlowId);
    const primary = list.find((f) => f.is_primary) || list[0];
    await loadUserConfig(primary?.id);
  }, [selectedFlowId, flowsList, loadUserConfig]);

  const setCurrentAsPrimary = useCallback(async () => {
    if (!selectedFlowId) return;
    const { error, data } = await supabase.functions.invoke('voice-config', { body: { action: 'set_primary', flowId: selectedFlowId } });
    if (error || !data?.ok) { toast({ title: 'Failed', description: error?.message || data?.error, variant: 'destructive' }); return; }
    toast({ title: 'Set as primary flow', description: 'Phone calls will now trigger this flow.' });
    refreshFlowsList();
  }, [selectedFlowId, refreshFlowsList]);

  const toggleFlowActive = useCallback(async (flowId, isActive) => {
    const { error, data } = await supabase.functions.invoke('voice-config', { body: { action: 'set_active', flowId, isActive } });
    if (error || !data?.ok) { toast({ title: 'Failed', description: error?.message || data?.error, variant: 'destructive' }); return; }
    refreshFlowsList();
  }, [refreshFlowsList]);

  // Forward-ref for hasUnsavedChanges so selectFlow can use it before declaration.
  const hasUnsavedChangesRef = useRef(null);


  const toggleAllowedProduct = useCallback((productId, checked) => {
    const id = String(productId);
    setVoiceSettings((prev) => {
      const current = new Set((prev.allowed_product_ids || []).map((v) => String(v)));
      if (checked) current.add(id);
      else current.delete(id);
      return { ...prev, allowed_product_ids: Array.from(current) };
    });
  }, []);

  const toggleCategoryProducts = useCallback((categoryProducts, checked) => {
    const ids = categoryProducts.map((p) => String(p.id));
    setVoiceSettings((prev) => {
      const current = new Set((prev.allowed_product_ids || []).map((v) => String(v)));
      ids.forEach((id) => {
        if (checked) current.add(id);
        else current.delete(id);
      });
      return { ...prev, allowed_product_ids: Array.from(current) };
    });
  }, []);

  const loadAdminContext = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('voice-admin', { body: { action:'get_admin_context' } });
    if (error || !data?.ok || !data?.isAdmin) { setAdminMode(false); return; }
    setAdminMode(true); setUsers(data.users || []);
  }, []);

  useEffect(() => {
    if (authLoading) return; // wait until Supabase has restored session from storage
    if (!user?.id) return;   // not logged in — no point calling functions
    loadUserConfig();
    loadAdminContext();
    // Only re-run when the actual user id changes, not on every token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  // RF connect
  const onConnect = useCallback((params) => {
    const newEdge = { ...params, id:makeId('edge'), type:'ivrEdge', markerEnd:{type:MarkerType.ArrowClosed,color:'#94a3b8'}, style:{stroke:'#94a3b8',strokeWidth:2}, data:{conditionType:'always',conditionValue:'', displayLabel:'', bendPoint:null} };
    setRfEdges((eds) => {
      const updated = addEdge(newEdge, eds);
      setGraphFlow((gf) => { const ng=rfToGraph(rfNodes,updated,gf); setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
      return updated;
    });
  }, [rfNodes, setRfEdges]);

  const onNodeDragStop = useCallback((_ev, _node, nodes) => {
    setGraphFlow((gf) => { const ng=rfToGraph(nodes,rfEdges,gf); setFlowJson(serializeFlow(ng)); return ng; });
  }, [rfEdges]);

  const onSelectionChange = useCallback(({ nodes, edges }) => {
    setSelNode(nodes.length===1 ? nodes[0] : null);
    setSelEdge(edges.length===1 ? edges[0] : null);
  }, []);

  // Add node from library
  const addNode = useCallback((type) => {
    const id = makeId('node');
    const meta = NODE_TYPE_META[type] || NODE_TYPE_META.message;
    const nodeData = { id, type, title:meta.label, prompt:type==='end'?'Thank you for calling. Goodbye.':'Edit this prompt.', captureVar:(type==='gather'||type==='branch')?'input_value':undefined, finishOnKey:type==='gather'?'#':undefined, maxDigits:type==='branch'?1:undefined };
    const rfNode = { id, type:'ivrNode', position:{ x:200+Math.random()*300, y:200+Math.random()*200 }, data:{ ...nodeData, isStart:false } };
    setRfNodes((nds) => {
      const updated = [...nds, rfNode];
      setGraphFlow((gf) => { const ng={...rfToGraph(updated,rfEdges,gf), startNodeId:gf.startNodeId||id}; setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
      return updated;
    });
  }, [rfEdges, setRfNodes]);

  // Update selected node
  const updateSelNode = useCallback((patch) => {
    if (!selNode) return;
    const id = selNode.id;
    setRfNodes((nds) => {
      const updated = nds.map((n) => n.id===id ? {...n, data:{...n.data,...patch}} : n);
      setSelNode((prev) => prev ? {...prev, data:{...prev.data,...patch}} : prev);
      setGraphFlow((gf) => { const ng=rfToGraph(updated,rfEdges,gf); setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
      return updated;
    });
  }, [selNode, rfEdges, setRfNodes]);

  // Delete selected node
  const deleteSelNode = useCallback(() => {
    if (!selNode) return;
    const id = selNode.id;
    setRfNodes((nds) => {
      if (nds.length<=1) { toast({ title:'Cannot remove last node.', variant:'destructive' }); return nds; }
      const updated = nds.filter((n) => n.id!==id);
      setRfEdges((eds) => {
        const updEds = eds.filter((e) => e.source!==id && e.target!==id);
        setGraphFlow((gf) => { const ns=gf.startNodeId===id?updated[0]?.id:gf.startNodeId; const ng={...rfToGraph(updated,updEds,gf),startNodeId:ns}; setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
        return updEds;
      });
      setSelNode(null);
      return updated;
    });
  }, [selNode, setRfNodes, setRfEdges]);

  // Update selected edge
  const updateSelEdge = useCallback((patch) => {
    if (!selEdge) return;
    const id = selEdge.id;
    setRfEdges((eds) => {
      const updated = eds.map((e) => {
        if (e.id!==id) return e;
        const merged={...e.data,...patch};
        return {...e, data:{...merged, displayLabel: edgeLabel({conditionType:merged.conditionType,conditionValue:merged.conditionValue})}};
      });
      setSelEdge((prev) => prev ? {...prev, data:{...prev.data,...patch, displayLabel: edgeLabel({conditionType:(patch.conditionType ?? prev.data?.conditionType),conditionValue:(patch.conditionValue ?? prev.data?.conditionValue)})}} : prev);
      setGraphFlow((gf) => { const ng=rfToGraph(rfNodes,updated,gf); setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
      return updated;
    });
  }, [selEdge, rfNodes, setRfEdges]);

  // Delete selected edge
  const deleteSelEdge = useCallback(() => {
    if (!selEdge) return;
    const id = selEdge.id;
    setRfEdges((eds) => {
      const updated = eds.filter((e) => e.id!==id);
      setGraphFlow((gf) => { const ng=rfToGraph(rfNodes,updated,gf); setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng)); return ng; });
      setSelEdge(null);
      return updated;
    });
  }, [selEdge, rfNodes, setRfEdges]);

  const setStartNode = useCallback((nodeId) => {
    setGraphFlow((gf) => {
      const ng = {...gf, startNodeId:nodeId};
      setFlowJson(serializeFlow(ng)); setValidationErrors(validateGraph(ng));
      setRfNodes((nds) => nds.map((n) => ({...n, data:{...n.data, isStart:n.id===nodeId}})));
      return ng;
    });
  }, [setRfNodes]);

  // Persist
  const persistDraft = async (f) => {
    const { data, error } = await supabase.functions.invoke('voice-config', { body:{action:'save_draft',flow:f, flowId: selectedFlowId || undefined} });
    if (error || !data?.ok) { toast({ title:'Save failed', description:error?.message||data?.error, variant:'destructive' }); return null; }
    setFlowVersion(data.version ?? flowVersion); setFlowPublished(false); return data;
  };

  const saveFlowDraft = async () => {
    const errors = validateGraph(graphFlow);
    if (errors.length) { toast({ title:`Fix ${errors.length} issue(s) first`, variant:'destructive' }); return; }
    const saved = await persistDraft(graphFlow);
    if (saved) toast({ title:'Draft saved' });
  };

  const publishFlow = async () => {
    const errors = validateGraph(graphFlow); setValidationErrors(errors);
    if (errors.length) { toast({ title:`Fix ${errors.length} issue(s) first`, variant:'destructive' }); return; }
    const saved = await persistDraft(graphFlow); if (!saved) return;
    const { data, error } = await supabase.functions.invoke('voice-config', { body:{action:'publish', flowId: selectedFlowId || undefined} });
    if (error || !data?.ok) { toast({ title:'Publish failed', variant:'destructive' }); return; }
    setFlowPublished(true);
    setPublishedFlow(graphFlow);
    // Refresh list so the published badge updates
    refreshFlowsList();
    toast({ title:'Flow published ✓' });
  };

  const resetToDefault = () => {
    const df = createDefaultGraphFlow();
    syncGraph(df);
    toast({ title: 'Default flow loaded', description: 'Click Publish to save.' });
  };

  const hasUnsavedChanges = () => {
    if (!publishedFlow) return false;
    return serializeFlow(graphFlow) !== serializeFlow(publishedFlow);
  };

  // Keep ref in sync so selectFlow can call it.
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  const handleCloseBuilder = () => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm('You have unsaved changes. Discard them and close?');
      if (!confirmed) return;
    }
    setBuilderOpen(false);
  };

  const loadSelectedUserChannel = async (targetUserId) => {
    if (!targetUserId) return;
    const { data, error } = await supabase.functions.invoke('voice-admin', { body:{action:'get_user_channel',targetUserId} });
    if (error || !data?.ok) { toast({ title:'Failed to load user channel', variant:'destructive' }); return; }
    setAssignPhone(formatDisplayPhone(data.channel?.inbound_phone_e164||'')); setAssignProviderAccountId(data.channel?.provider_account_id||''); setAssignEnabled(!!data.channel?.voice_ordering_enabled);
  };

  const handleAssignAndEnable = async () => {
    if (!selectedUserId || !assignPhone) { toast({ title:'Missing fields', variant:'destructive' }); return; }
    const normalizedPhone = canonicalStorePhone(assignPhone);
    if (normalizedPhone.length!==10) { toast({ title:'Invalid phone', variant:'destructive' }); return; }
    setAdminBusy(true);
    const r1 = await supabase.functions.invoke('voice-admin', { body:{action:'assign_phone_number',targetUserId:selectedUserId,phoneNumberE164:normalizedPhone,providerAccountId:assignProviderAccountId,webhookSecret:assignWebhookSecret} });
    if (r1.error || !r1.data?.ok) { toast({ title:'Assign failed', variant:'destructive' }); setAdminBusy(false); return; }
    const r2 = await supabase.functions.invoke('voice-admin', { body:{action:'set_voice_enabled',targetUserId:selectedUserId,enabled:assignEnabled} });
    if (r2.error || !r2.data?.ok) { toast({ title:'Enable update failed', variant:'destructive' }); setAdminBusy(false); return; }
    setAdminBusy(false); setAssignPhone(formatDisplayPhone(normalizedPhone)); setAssignWebhookSecret(''); toast({ title:'User voice setup saved' });
  };

  const openBuilder = () => { pushToRf(graphFlow); setBuilderOpen(true); };

  // Inspector
  const renderInspector = () => {
    if (selEdge) {
      const ed = selEdge.data || {};
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Arrow Condition</p>
            <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={deleteSelEdge}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">When to follow this arrow</Label>
            <Select value={ed.conditionType||'always'} onValueChange={(v) => updateSelEdge({ conditionType:v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EDGE_CONDITION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {ed.conditionType==='digit' && (
            <div className="space-y-2">
              <Label className="text-xs">Digit value</Label>
              <Input value={ed.conditionValue||''} onChange={(e) => updateSelEdge({ conditionValue:e.target.value })} placeholder="e.g. 1" />
            </div>
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={() => updateSelEdge({ bendPoint: null })}>Reset Line Route</Button>
          <p className="text-xs text-muted-foreground pt-2">Click the line, then drag the round bend handle to route it exactly where you want.</p>
        </div>
      );
    }
    if (selNode) {
      const nd = selNode.data;
      const meta = NODE_TYPE_META[nd.type] || NODE_TYPE_META.message;
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ color:meta.color }}>{meta.icon}</span>
              <p className="font-semibold text-sm">{meta.label}</p>
            </div>
            {!nd.isStart && <Button size="sm" variant="ghost" className="text-destructive h-7 px-2" onClick={deleteSelNode}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Node type</Label>
            <Select value={nd.type} onValueChange={(v) => updateSelNode({ type:v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(NODE_TYPE_META).map(([k,v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Node title</Label>
            <Input value={nd.title||''} onChange={(e) => updateSelNode({ title:e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Caller hears (prompt)</Label>
            <Textarea value={nd.prompt||''} onChange={(e) => updateSelNode({ prompt:e.target.value })} className="min-h-[90px] text-sm" />
          </div>
          {(nd.type==='gather'||nd.type==='branch') && <>
            <div className="space-y-2"><Label className="text-xs">Save input to variable</Label><Input value={nd.captureVar||''} onChange={(e) => updateSelNode({ captureVar:e.target.value })} placeholder="sku" /></div>
            <div className="space-y-2"><Label className="text-xs">Max digits</Label><Input type="number" value={nd.maxDigits||''} onChange={(e) => { const n=parseInt(e.target.value,10); updateSelNode({ maxDigits:isNaN(n)?null:n }); }} placeholder="1" /></div>
          </>}
          {nd.type==='gather' && <div className="space-y-2"><Label className="text-xs">Finish key</Label><Input value={nd.finishOnKey||''} onChange={(e) => updateSelNode({ finishOnKey:e.target.value||null })} placeholder="#" /></div>}
          {!nd.isStart && <Button size="sm" variant="outline" className="w-full" onClick={() => setStartNode(selNode.id)}>Set as Start Node</Button>}
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground py-12">
        <Sparkles className="h-8 w-8 opacity-20" />
        <p className="text-sm font-medium">Click any node or arrow</p>
        <p className="text-xs opacity-60">Drag node bottom dot → another node top dot to connect them.</p>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b pb-0">
        {[
          { id: 'editor', label: '📋 Phone Script' },
          { id: 'settings', label: '⚙️ Settings' },
          { id: 'advanced', label: '🛠 Advanced' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'advanced') { pushToRf(graphFlow); } }}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Phone Script tab ── */}
      {activeTab === 'editor' && (
        <>
          {loadingUserConfig ? (
            <div className="flex items-center gap-3 p-8 text-muted-foreground justify-center">
              <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>Loading your call flow…</span>
            </div>
          ) : (
            <FlowListEditor
              graphFlow={graphFlow}
              syncGraph={syncGraph}
              flowPublished={flowPublished}
              flowVersion={flowVersion}
              saveFlowDraft={saveFlowDraft}
              publishFlow={publishFlow}
              resetToDefault={resetToDefault}
              channelPhone={channelPhone}
              channelEnabled={channelEnabled}
              adminMode={adminMode}
              flowsList={flowsList}
              selectedFlowId={selectedFlowId}
              onSelectFlow={selectFlow}
              onCreateFlow={createNewFlow}
              onRenameFlow={renameCurrentFlow}
              onDeleteFlow={deleteCurrentFlow}
              onSetPrimary={setCurrentAsPrimary}
              onToggleActive={toggleFlowActive}
            />
          )}
        </>
      )}

      {/* ── Settings tab ── */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice Ordering Status</CardTitle>
              <CardDescription>Your assigned phone number and feature status.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUserConfig ? <p className="text-sm text-muted-foreground">Loading...</p> : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Voice enabled</p><p className="font-semibold">{channelEnabled ? 'Yes' : 'No'}</p></div>
                  <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Assigned phone</p><p className="font-semibold">{formatDisplayPhone(channelPhone) || 'Not assigned'}</p></div>
                  <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Flow version</p><p className="font-semibold">v{flowVersion || '-'} · {flowModeLabel.toLowerCase()}</p></div>
                  <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Steps / paths</p><p className="font-semibold">{graphFlow.nodes.length} steps · {graphFlow.edges.length} paths</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phone Ordering Settings</CardTitle>
              <CardDescription>Control which products can be ordered by phone and stock behavior.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Allow out-of-stock orders</p>
                  <p className="text-xs text-muted-foreground">Callers can order items even when stock is zero.</p>
                </div>
                <Switch checked={voiceSettings.allow_out_of_stock} onCheckedChange={(v) => setVoiceSettings((s) => ({ ...s, allow_out_of_stock: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Restrict to specific products</p>
                  <p className="text-xs text-muted-foreground">Only allow callers to order from a selected product list.</p>
                </div>
                <Switch checked={voiceSettings.restrict_products} onCheckedChange={(v) => setVoiceSettings((s) => ({ ...s, restrict_products: v }))} />
              </div>
              {voiceSettings.restrict_products && (
                <div className="space-y-3 rounded-xl border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Label className="text-sm font-medium">Allowed products</Label>
                      <p className="text-xs text-muted-foreground">{allowedProductIds.size} selected out of {voiceProducts.length} total products.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setVoicePickerOpen(true)}>Choose Products</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Use the category picker dialog to select products quickly for large catalogs.</p>
                </div>
              )}
              <Button disabled={savingVoiceSettings} onClick={saveVoiceSettings}>{savingVoiceSettings ? 'Saving…' : 'Save Settings'}</Button>
            </CardContent>
          </Card>

          {adminMode && (
            <Card>
              <CardHeader>
                <CardTitle>Platform Admin Controls</CardTitle>
                <CardDescription>Assign and enable voice ordering for store users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label>Select user</Label>
                  <Select value={selectedUserId} onValueChange={(v) => { setSelectedUserId(v); loadSelectedUserChannel(v); }}>
                    <SelectTrigger><SelectValue placeholder="Select store user" /></SelectTrigger>
                    <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.email || u.id}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedUser && <div className="rounded-md border p-3 text-sm text-muted-foreground">Managing: <span className="font-medium text-foreground">{selectedUser.email || selectedUser.id}</span></div>}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2"><Label>Inbound phone</Label><Input value={assignPhone} onChange={(e) => setAssignPhone(formatDisplayPhone(e.target.value))} placeholder="(845)-222-2222" /></div>
                  <div className="space-y-2"><Label>Provider account id</Label><Input value={assignProviderAccountId} onChange={(e) => setAssignProviderAccountId(e.target.value)} placeholder="Optional" /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Webhook secret</Label><Input type="password" value={assignWebhookSecret} onChange={(e) => setAssignWebhookSecret(e.target.value)} placeholder="Optional" /></div>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3 max-w-md">
                  <div><p className="font-medium">Voice ordering enabled</p><p className="text-xs text-muted-foreground">Toggle for selected user.</p></div>
                  <Switch checked={assignEnabled} onCheckedChange={setAssignEnabled} />
                </div>
                <Button disabled={adminBusy} onClick={handleAssignAndEnable}>{adminBusy ? 'Saving...' : 'Save Admin Setup'}</Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Advanced tab ── */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <span className="text-amber-500 text-lg">⚠️</span>
            <div>
              <p className="font-semibold text-sm text-amber-800">Advanced / Developer Mode</p>
              <p className="text-xs text-amber-700">This is the raw flow builder for developers. Changes here override the Phone Script editor. Use only if you know what you are doing.</p>
            </div>
          </div>
          <Card>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Voice enabled</p><p className="font-semibold">{channelEnabled ? 'Yes' : 'No'}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Assigned phone</p><p className="font-semibold">{formatDisplayPhone(channelPhone) || 'Not assigned'}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Flow version</p><p className="font-semibold">v{flowVersion || '-'} · {flowModeLabel.toLowerCase()}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Nodes / arrows</p><p className="font-semibold">{graphFlow.nodes.length} nodes · {graphFlow.edges.length} arrows</p></div>
              </div>
            </CardContent>
          </Card>
          <Button onClick={openBuilder}><PencilLine className="mr-2 h-4 w-4" />Open Flow Builder</Button>
        </div>
      )}

      {/* Product picker dialog */}
      <Dialog open={voicePickerOpen} onOpenChange={setVoicePickerOpen}>
        <DialogContent className="w-[95vw] max-w-6xl h-[88vh] p-0 overflow-hidden flex flex-col">
          <div className="border-b px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Select Allowed Products</h3>
                <p className="text-sm text-muted-foreground">Filter by category and search to quickly select large product lists.</p>
              </div>
              <div className="text-sm text-muted-foreground">{allowedProductIds.size} selected</div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="sm:w-72">
                <Select value={voicePickerCategory} onValueChange={setVoicePickerCategory}>
                  <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {productsByCategory.map((group) => (<SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Input value={voicePickerQuery} onChange={(e) => setVoicePickerQuery(e.target.value)} placeholder="Search name, SKU, or barcode" className="sm:flex-1" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {filteredCategoryGroups.length === 0 && (<div className="rounded-lg border p-6 text-sm text-muted-foreground">No products match your filters.</div>)}
            {filteredCategoryGroups.map((group) => {
              const selectedCount = group.products.filter((p) => allowedProductIds.has(String(p.id))).length;
              const allSelected = group.products.length > 0 && selectedCount === group.products.length;
              return (
                <div key={group.id} className="rounded-xl border">
                  <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                    <div><p className="font-medium text-sm">{group.name}</p><p className="text-xs text-muted-foreground">{selectedCount}/{group.products.length} selected</p></div>
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 rounded" checked={allSelected} onChange={(e) => toggleCategoryProducts(group.products, e.target.checked)} />
                      Select all
                    </label>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y">
                    {group.products.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/30">
                        <input type="checkbox" className="h-4 w-4 rounded" checked={allowedProductIds.has(String(p.id))} onChange={(e) => toggleAllowedProduct(p.id, e.target.checked)} />
                        <span className="text-sm flex-1">{p.name || 'Unnamed product'}</span>
                        {p.sku && <span className="text-xs text-muted-foreground">{p.sku}</span>}
                        {p.barcode && <span className="text-xs text-muted-foreground">{p.barcode}</span>}
                        <span className="text-xs text-muted-foreground">stock: {p.stock ?? '—'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t px-5 py-3 flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setVoicePickerOpen(false)}>Close</Button>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setVoiceSettings((s) => ({ ...s, allowed_product_ids: [] }))}>Clear All</Button>
              <Button type="button" onClick={() => setVoicePickerOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Builder Dialog */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent ref={builderRootRef} className="w-screen h-screen max-w-none max-h-none p-0 rounded-none m-0 fixed inset-0 flex flex-col" style={{ transform: 'none', top: 0, left: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-3 shrink-0 bg-background z-10">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold text-base leading-tight">IVR Flow Builder</h2>
                <p className="text-xs text-muted-foreground">Drag nodes · Connect arrows · Configure each step</p>
              </div>
              <Badge variant="outline" className="ml-2 hidden sm:flex">{user?.email||''}</Badge>
              <Badge variant={flowPublished?'default':'secondary'}>{flowModeLabel}</Badge>
              {validationErrors.length>0 && <Badge variant="destructive">{validationErrors.length} issue(s)</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={saveFlowDraft}>Save Draft</Button>
              <Button size="sm" onClick={publishFlow}>Publish</Button>
              <Button size="sm" variant="outline" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4 mr-1" /> : <Maximize2 className="h-4 w-4 mr-1" />}
                {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </Button>
              <Button size="sm" variant="ghost" title="Reset to default" onClick={resetToDefault}><RefreshCw className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" title="Close builder" onClick={handleCloseBuilder}><X className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left sidebar */}
            <div className="w-[170px] shrink-0 border-r bg-muted/20 flex flex-col overflow-y-auto min-h-0">
              <div className="px-3 pt-4 pb-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Node</p>
                <div className="space-y-1">
                  {Object.entries(NODE_TYPE_META).map(([type,meta]) => (
                    <button key={type} type="button" onClick={() => addNode(type)} className="w-full flex items-center gap-2 rounded-lg border bg-background px-2.5 py-2 text-left text-xs hover:border-primary/50 hover:bg-accent transition-colors" style={{ borderLeftColor:meta.color, borderLeftWidth:3 }}>
                      <span>{meta.icon}</span>
                      <span className="font-medium" style={{ color:meta.color }}>{meta.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-3 mt-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">How to use</p>
                <ul className="text-[11px] text-muted-foreground space-y-1">
                  <li>• Click node to configure</li>
                  <li>• Drag bottom dot → top dot</li>
                  <li>• Click arrow to set condition</li>
                  <li>• Drag nodes to rearrange</li>
                </ul>
              </div>
              {validationErrors.length>0 && (
                <div className="mx-3 mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                  <p className="text-[10px] font-semibold text-destructive mb-1">Issues</p>
                  <ul className="text-[11px] text-destructive space-y-0.5">{validationErrors.slice(0,5).map((e,i) => <li key={i}>• {e}</li>)}</ul>
                </div>
              )}
              <div className="mt-auto border-t p-3">
                <button type="button" onClick={() => setShowJson((v)=>!v)} className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                  <FileCode2 className="h-3.5 w-3.5" />{showJson?'Hide JSON':'Show JSON'}
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="relative" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
              {showJson ? (
                <div className="absolute inset-0 overflow-auto p-4">
                  <Textarea value={flowJson} onChange={(e) => { setFlowJson(e.target.value); try { const p=toGraphFlow(JSON.parse(e.target.value)); syncGraph(p); } catch {} }} className="h-full min-h-full font-mono text-xs" />
                </div>
              ) : (
                <ReactFlow nodes={rfNodes} edges={rfEdges} onNodesChange={onRfNodesChange} onEdgesChange={onRfEdgesChange} onConnect={onConnect} onNodeDragStop={onNodeDragStop} onSelectionChange={onSelectionChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView fitViewOptions={{ padding:0.06, minZoom:0.32, maxZoom:1.25 }} deleteKeyCode={null} style={{ background:'#f8fafc', width:'100%', height:'100%', position:'absolute', inset:0 }}>
                  <Background color="#cbd5e1" gap={18} size={1} />
                  <Controls />
                  <MiniMap nodeColor={(n) => NODE_TYPE_META[n.data?.type]?.color||'#94a3b8'} zoomable pannable style={{ width:120, height:96, bottom:12, right:12, opacity:0.8 }} />
                  <Panel position="top-right" className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 bg-background border rounded-lg px-3 py-1.5 shadow-sm text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      Starts at <span className="font-medium text-foreground ml-1">{graphFlow.nodes.find((n)=>n.id===graphFlow.startNodeId)?.title||'?'}</span>
                    </div>
                    <Button size="sm" variant="outline" className="self-end shadow-sm" onClick={runAutoLayout}>Auto Layout</Button>
                  </Panel>
                </ReactFlow>
              )}
            </div>

            {/* Inspector */}
            <div className="w-[240px] shrink-0 border-l bg-background overflow-y-auto p-4 min-h-0">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-4">Inspector</p>
              {renderInspector()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default VoiceOrderingSettings;
