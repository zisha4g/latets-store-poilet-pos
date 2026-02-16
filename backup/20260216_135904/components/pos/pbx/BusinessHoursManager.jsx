import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const BusinessHoursManager = ({ businessHours, onUpdate }) => {
  const [hours, setHours] = useState([]);

  useEffect(() => {
    const initialHours = days.map((day, index) => {
      const existing = businessHours.find(h => h.day_of_week === index);
      return existing || {
        day_of_week: index,
        is_open: false,
        open_time: '09:00',
        close_time: '17:00'
      };
    });
    setHours(initialHours);
  }, [businessHours]);

  const handleToggle = (dayIndex) => {
    setHours(prev => prev.map((day, i) =>
      i === dayIndex ? { ...day, is_open: !day.is_open } : day
    ));
  };

  const handleTimeChange = (dayIndex, type, value) => {
    setHours(prev => prev.map((day, i) =>
      i === dayIndex ? { ...day, [type]: value } : day
    ));
  };

  const handleSave = async () => {
    try {
      await onUpdate(hours);
      toast({ title: 'Success', description: 'Business hours have been updated.' });
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Hours</CardTitle>
        <CardDescription>Define when your business is open. This affects call routing for your IVR.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {days.map((day, index) => {
            const dayHours = hours[index] || {};
            return (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <Label className="w-24 font-medium">{day}</Label>
                <div className="flex items-center gap-4">
                  <Switch checked={dayHours.is_open || false} onCheckedChange={() => handleToggle(index)} />
                  <span className="text-sm">{dayHours.is_open ? 'Open' : 'Closed'}</span>
                </div>
                {dayHours.is_open && (
                  <div className="flex items-center gap-4">
                    <Input type="time" value={dayHours.open_time || '09:00'} onChange={(e) => handleTimeChange(index, 'open_time', e.target.value)} className="w-32" />
                    <span>to</span>
                    <Input type="time" value={dayHours.close_time || '17:00'} onChange={(e) => handleTimeChange(index, 'close_time', e.target.value)} className="w-32" />
                  </div>
                )}
                {!dayHours.is_open && <div className="w-[304px]" />}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save Changes</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessHoursManager;