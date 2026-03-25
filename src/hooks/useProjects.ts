import { useState, useEffect, useMemo } from "react";
import { externalSupabase } from "@/lib/externalSupabase";

export interface Project {
  id: string;
  department: string;
  group_name: string;
  name: string;
}

export interface ProjectGroup {
  groupName: string;
  projects: Project[];
}

export function useProjects(department: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      const { data, error: err } = await externalSupabase
        .from("projects")
        .select("*")
        .eq("department", department)
        .order("id", { ascending: true });

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setProjects(
        (data || []).map((r: any) => ({
          id: r.id,
          department: r.department,
          group_name: r.group_name,
          name: r.name,
        }))
      );
      setLoading(false);
    };
    fetch();
    return () => { cancelled = true; };
  }, [department]);

  const groups: ProjectGroup[] = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects) {
      const key = p.group_name || "Без группы";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).map(([groupName, projects]) => ({
      groupName,
      projects,
    }));
  }, [projects]);

  return { projects, groups, loading, error };
}
