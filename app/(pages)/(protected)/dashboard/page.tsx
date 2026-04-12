'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Shield, Monitor, Activity, Server, Database, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await fetch('/api/ldap/dashboard');
        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to fetch dashboard data');
        }
        const json = await res.json();
        setData(json);
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto py-8 px-4">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Activity className="h-12 w-12 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground animate-pulse">Loading dashboard data...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-8 px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground">Real-time status and directory statistics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connection</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Online</div>
              <p className="text-xs text-muted-foreground">Session active and verified</p>
            </CardContent>
          </Card>

          <StatCard title="Total Users" value={data?.stats.users} icon={<Users className="h-4 w-4 text-blue-500" />} subValue="Active accounts" />
          <StatCard title="Total Groups" value={data?.stats.groups} icon={<Shield className="h-4 w-4 text-purple-500" />} subValue="Security & Distribution" />
          <StatCard title="Total Computers" value={data?.stats.computers} icon={<Monitor className="h-4 w-4 text-orange-500" />} subValue="Workstations" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Active Connection Details
              </CardTitle>
              <CardDescription>Configuration details for the current active profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Profile Name</p>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">{data?.profile.name}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Host Endpoint</p>
                <p className="text-sm font-mono bg-muted px-2 py-0.5 rounded inline-block">
                  {data?.profile.protocol}://{data?.profile.hostname}:{data?.profile.port}
                </p>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Base Distinguished Name (Base DN)</p>
                <p className="text-sm font-mono break-all bg-muted/50 p-2 rounded border border-border/50">
                  {data?.profile.baseDN || '(Not configured)'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, subValue }: { title: string, value: number, icon: React.ReactNode, subValue: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subValue}</p>
      </CardContent>
    </Card>
  );
}