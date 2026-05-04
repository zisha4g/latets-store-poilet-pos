import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';

const SettingsUsers = () => (
  <div className="space-y-6">
    <div>
      <h3 className="text-xl font-semibold">Team Members</h3>
      <p className="text-muted-foreground">
        Invite staff to your store and manage their permissions.
      </p>
    </div>
    <Card>
      <CardContent className="py-12 flex flex-col items-center text-center gap-3">
        <Users className="w-10 h-10 text-muted-foreground" />
        <h4 className="text-lg font-semibold">Team management coming soon</h4>
        <p className="text-sm text-muted-foreground max-w-md">
          Per-store team accounts and roles aren't available yet. Platform-wide
          user management lives in the dedicated <strong>Admin</strong> dashboard
          (visible in the sidebar for administrators only).
        </p>
      </CardContent>
    </Card>
  </div>
);

export default SettingsUsers;
