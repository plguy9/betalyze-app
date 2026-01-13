// hooks/useNbaTeams.ts
'use client';

import { useEffect, useState } from 'react';
import type { BetalyzeNbaTeam, BetalyzeNbaTeamsPayload } from '@/app/api/nba/teams/route';

type UseNbaTeamsOptions = {
  season?: string;
};

type UseNbaTeamsResult = {
  data: BetalyzeNbaTeamsPayload | null;
  teams: BetalyzeNbaTeam[];
  loading: boolean;
  error: string | null;
};

export function useNbaTeams(options: UseNbaTeamsOptions = {}): UseNbaTeamsResult {
  const { season } = options;

  const [data, setData] = useState<BetalyzeNbaTeamsPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchTeams() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (season) params.set('season', season);

        const res = await fetch(`/api/nba/teams${params.toString() ? `?${params}` : ''}`);

        if (!res.ok) {
          throw new Error(`Failed to fetch teams (status ${res.status})`);
        }

        const json = (await res.json()) as BetalyzeNbaTeamsPayload;

        if (!isMounted) return;
        setData(json);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message ?? 'Unknown error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchTeams();

    return () => {
      isMounted = false;
    };
  }, [season]);

  return {
    data,
    teams: data?.teams ?? [],
    loading,
    error,
  };
}