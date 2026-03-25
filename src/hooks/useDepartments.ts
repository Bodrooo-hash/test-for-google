import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/lib/externalSupabase";

export interface Department {
  name: string;
  parent_name: string | null;
}

export interface DepartmentNode {
  name: string;
  children: DepartmentNode[];
}

export interface DepartmentGroup {
  parent: string;
  children: string[];
}

/**
 * Build a recursive tree from the flat departments list.
 */
function buildTree(departments: Department[]): DepartmentNode[] {
  const byParent = new Map<string | null, Department[]>();
  for (const d of departments) {
    const key = d.parent_name ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(d);
  }

  const build = (parentName: string | null): DepartmentNode[] => {
    const children = byParent.get(parentName) || [];
    return children.map(d => ({
      name: d.name,
      children: build(d.name),
    }));
  };

  return build(null);
}

/** Collect all department names from a tree (recursive). */
function collectNames(nodes: DepartmentNode[]): string[] {
  const result: string[] = [];
  const walk = (n: DepartmentNode) => {
    result.push(n.name);
    n.children.forEach(walk);
  };
  nodes.forEach(walk);
  return result;
}

/**
 * Fetches departments from the `departments` table and
 * returns them organized as a flat list, grouped (legacy), and recursive tree.
 */
export function useDepartments() {
  const query = useQuery<Department[]>({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("departments")
        .select("name, parent_name")
        .order("name");
      if (error) throw error;
      return (data || []) as Department[];
    },
    staleTime: 30 * 60 * 1000,
  });

  const departments = query.data || [];
  const tree = buildTree(departments);
  const flatNames = collectNames(tree);

  // Legacy grouped format (one-level grouping for backward compat)
  const parentNames = new Set(departments.filter(d => !d.parent_name).map(d => d.name));
  const childDepts = departments.filter(d => d.parent_name);
  const standaloneParents = departments.filter(d => !d.parent_name && !childDepts.some(c => c.parent_name === d.name));

  const grouped: DepartmentGroup[] = [];
  const parentsWithChildren = [...new Set(childDepts.map(c => c.parent_name!))];
  for (const parent of parentsWithChildren) {
    grouped.push({
      parent,
      children: childDepts.filter(c => c.parent_name === parent).map(c => c.name),
    });
  }
  for (const dept of standaloneParents) {
    grouped.push({ parent: dept.name, children: [] });
  }

  return {
    ...query,
    departments,
    tree,
    grouped,
    flatNames,
  };
}
