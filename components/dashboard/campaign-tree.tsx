"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import type { TreeNode } from "@/lib/dashboard/campaign-tree";

function Row({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = Boolean(node.children && node.children.length > 0);

  return (
    <>
      <tr className="border-b border-border last:border-0">
        <td className="px-4 py-2.5" style={{ paddingLeft: `${1 + depth * 1.5}rem` }}>
          <button
            type="button"
            onClick={() => hasChildren && setOpen((o) => !o)}
            className={cn("flex items-center gap-2 text-left", !hasChildren && "cursor-default")}
          >
            {hasChildren ? (
              open ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate text-sm" title={node.name}>
              {node.name}
            </span>
          </button>
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{formatCurrency(node.spend)}</td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{node.views}</td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{node.conversions}</td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">
          {node.conversionRate !== null ? `${(node.conversionRate * 100).toFixed(1)}%` : "—"}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">{formatCurrency(node.revenue)}</td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">
          {node.roas !== null ? `${node.roas.toFixed(2)}x` : "—"}
        </td>
        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums">
          {node.cpa !== null ? formatCurrency(node.cpa) : "—"}
        </td>
      </tr>
      {hasChildren && open && node.children!.map((child) => <Row key={child.id} node={child} depth={depth + 1} />)}
    </>
  );
}

export function CampaignTree({ campaigns }: { campaigns: TreeNode[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Campanha</th>
            <th className="px-4 py-3 text-right font-medium">Investido</th>
            <th className="px-4 py-3 text-right font-medium">Visualizações</th>
            <th className="px-4 py-3 text-right font-medium">Conversões</th>
            <th className="px-4 py-3 text-right font-medium">Taxa de conversão</th>
            <th className="px-4 py-3 text-right font-medium">Receita</th>
            <th className="px-4 py-3 text-right font-medium">ROAS</th>
            <th className="px-4 py-3 text-right font-medium">CPA</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <Row key={c.id} node={c} depth={0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
