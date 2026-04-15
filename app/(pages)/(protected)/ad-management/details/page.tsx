'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Loader2, User, Users2, Monitor, Mail, Shield, Calendar, Clock, Briefcase, ListFilter } from 'lucide-react';
import { toast } from 'sonner';
import { getAccountStatus, isAccountEnabled } from '@/lib/constants/ldap-attributes';
import { ObjectPermissions } from '@/components/ad/object-permissions';

function DetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const dn = searchParams.get('dn');

  const [item, setItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (dn) {
      loadDetails();
    }
  }, [dn]);

  const loadDetails = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/ldap/objects/details?dn=${encodeURIComponent(dn!)}`);
      if (!res.ok) throw new Error('Failed to load object details');
      const data = await res.json();
      setItem(data);

      // If it's a group, load members
      if (data.objectClass.includes('group')) {
        loadGroupMembers(data.dn);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error loading details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroupMembers = async (groupDN: string) => {
    try {
      setIsLoadingMembers(true);
      const res = await fetch('/api/ldap/groups/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupDN }),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading object details...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-xl font-semibold mb-4">Object not found</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  const isUser = item.objectClass.includes('user') && !item.objectClass.includes('computer');
  const isComputer = item.objectClass.includes('computer');
  const isGroup = item.objectClass.includes('group');

  const memberships = Array.isArray(item.memberOf) ? item.memberOf : item.memberOf ? [item.memberOf] : [];

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-none mb-6">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2">
          <ChevronLeft className="h-4 w-4" />
          Back to AD Manager
        </Button>
      </div>

      <div className="flex flex-1 gap-8 overflow-hidden">
        {/* Left Column: Basic Info & Actions - Sticky/Non-scrolling wrapper */}
        <div className="w-80 flex-none space-y-6 overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                {isUser && <User className="h-10 w-10 text-primary" />}
                {isComputer && <Monitor className="h-10 w-10 text-primary" />}
                {isGroup && <Users2 className="h-10 w-10 text-primary" />}
              </div>
              <h1 className="text-xl font-bold break-all">{item.displayName || item.cn}</h1>
              <p className="text-sm text-muted-foreground mb-4 font-mono text-xs">{item.sAMAccountName}</p>

              {(isUser || isComputer) && (
                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isAccountEnabled(item.userAccountControl)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {getAccountStatus(item.userAccountControl)}
                </div>
              )}
            </div>

            <div className="mt-8 space-y-4 pt-6 border-t">
              {item.mail && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{item.mail}</span>
                </div>
              )}
              {item.title && (
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{item.title}</span>
                </div>
              )}
              {item.department && (
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{item.department}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">Created: {item.whenCreated}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs">Modified: {item.whenChanged}</span>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold mb-4">Distinguished Name</h3>
            <p className="text-[10px] font-mono bg-muted p-3 rounded-md break-all leading-relaxed text-muted-foreground">
              {item.dn}
            </p>
          </div>
        </div>

        {/* Right Column: Tabbed Detailed Lists - Independent scroll */}
        <div className="flex-1 min-w-0 bg-card border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <Tabs defaultValue={isGroup ? "members" : "member-of"} className="flex flex-col h-full">
            <div className="px-6 pt-4 border-b bg-muted/20">
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                {isGroup && (
                  <TabsTrigger
                    value="members"
                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 font-semibold"
                  >
                    Members
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="member-of"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 font-semibold"
                >
                  Member Of
                </TabsTrigger>
                <TabsTrigger
                  value="permissions"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 py-2 font-semibold"
                >
                  Permissions
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isGroup && (
                <TabsContent value="members" className="m-0 focus-visible:ring-0">
                  <div className="px-6 py-4 border-b bg-muted/10 flex items-center justify-between sticky top-0 z-10">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-primary" />
                      Direct Members ({members.length})
                    </h3>
                    {isLoadingMembers && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                  {members.length > 0 ? (
                    <div className="divide-y">
                      {members.map((member) => (
                        <div key={member.dn} className="px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors group">
                          <div className="min-w-0 flex items-center gap-3">
                            {member.type === 'User' && <User className="h-4 w-4 text-blue-500" />}
                            {member.type === 'Group' && <Users2 className="h-4 w-4 text-purple-500" />}
                            {member.type === 'Computer' && <Monitor className="h-4 w-4 text-green-500" />}
                            <div className="truncate">
                              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{member.displayName || member.cn}</p>
                              <p className="text-[10px] text-muted-foreground truncate font-mono">{member.sAMAccountName}</p>
                            </div>
                          </div>
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full border">{member.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-12 text-center text-muted-foreground text-sm italic">
                      No members found in this group.
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="member-of" className="m-0 focus-visible:ring-0">
                <div className="px-6 py-4 border-b bg-muted/10 sticky top-0 z-10">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Parent Groups ({memberships.length})
                  </h3>
                </div>
                {memberships.length > 0 ? (
                  <div className="divide-y">
                    {memberships.map((groupDN: string) => {
                      const groupName = groupDN.split(',')[0].replace(/^CN=/i, '');
                      return (
                        <div key={groupDN} className="px-6 py-4 flex flex-col hover:bg-muted/50 transition-colors group">
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{groupName}</p>
                          <p className="text-[10px] text-muted-foreground truncate font-mono">{groupDN}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-12 text-center text-muted-foreground text-sm italic">
                    This object is not a member of any groups.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="permissions" className="m-0 focus-visible:ring-0">
                <div className="px-6 py-4 border-b bg-muted/10 sticky top-0 z-10">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ListFilter className="h-4 w-4 text-primary" />
                    Security Identifiers & Rights
                  </h3>
                </div>
                <ObjectPermissions dn={item.dn} hideCard={true} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function ADObjectDetailsPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <Header />
      <main className="container mx-auto py-8 px-4 max-w-5xl">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading details...</p>
          </div>
        }>
          <DetailsContent />
        </Suspense>
      </main>
    </div>
  );
}
