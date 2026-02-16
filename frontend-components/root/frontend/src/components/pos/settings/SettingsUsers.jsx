import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const SettingsUsers = () => {
  const { toast } = useToast();

  const handleInviteUser = () => {
    toast({
      title: "🚧 Feature In Development",
      description: "User invitation and role management are coming soon!",
    });
  };

  const users = [
    { id: 1, name: 'Admin User', email: 'admin@example.com', role: 'Admin' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold">Users & Permissions</h3>
        <p className="text-muted-foreground">Manage who has access to your store and what they can do.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Manage Users</CardTitle>
            <CardDescription>Invite new users and manage existing ones.</CardDescription>
          </div>
          <Button onClick={handleInviteUser}>
            <Plus className="w-4 h-4 mr-2" /> Invite User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Role</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary">{user.role}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={handleInviteUser}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsUsers;