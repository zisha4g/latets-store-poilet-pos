import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Save } from 'lucide-react';

const AppointmentModal = ({ isOpen, onClose, appointment, selectedDate, onSave, onDelete, allAppointments = [], newAppointmentTime = null }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: selectedDate.toISOString().split('T')[0],
    time: '09:00',
    duration: '1', // hours
    location: '',
    type: 'meeting', // meeting, call, video, other
    notes: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [conflictError, setConflictError] = useState('');

  useEffect(() => {
    if (appointment) {
      setFormData({
        ...appointment,
        date: appointment.date?.split('T')[0] || selectedDate.toISOString().split('T')[0],
      });
    } else if (newAppointmentTime) {
      // Pre-fill time from weekly view
      setFormData(prev => ({
        ...prev,
        date: newAppointmentTime.date,
        time: newAppointmentTime.time,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        date: selectedDate.toISOString().split('T')[0],
      }));
    }
  }, [appointment, selectedDate, isOpen, newAppointmentTime]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Please enter an appointment title');
      return;
    }
    if (isSaving) return; // Prevent duplicate submissions

    // Check for overlapping appointments
    setConflictError('');
    const appointmentDate = new Date(formData.date);
    const [hours, minutes] = formData.time.split(':').map(Number);
    const startTime = new Date(appointmentDate);
    startTime.setHours(hours, minutes, 0, 0);
    const duration = parseFloat(formData.duration) || 1;
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    // Get appointments for the same day (excluding current appointment if editing)
    const sameDay = allAppointments.filter(apt => {
      const aptDate = new Date(apt.date).toDateString();
      const formDate = appointmentDate.toDateString();
      return aptDate === formDate && apt.id !== appointment?.id; // Exclude current appointment if editing
    });

    // Check for conflicts
    for (const existing of sameDay) {
      const [existHours, existMinutes] = existing.time.split(':').map(Number);
      const existStart = new Date(appointmentDate);
      existStart.setHours(existHours, existMinutes, 0, 0);
      const existDuration = parseFloat(existing.duration) || 1;
      const existEnd = new Date(existStart.getTime() + existDuration * 60 * 60 * 1000);

      // Check if times overlap
      if (startTime < existEnd && endTime > existStart) {
        const existEndTime = new Date(existEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const conflictMsg = `Time conflict! "${existing.title}" is scheduled from ${existing.time} to ${existEndTime}`;
        setConflictError(conflictMsg);
        return;
      }
    }
    
    setIsSaving(true);
    // Don't include temp ID - let database generate UUID
    onSave({
      ...formData,
      ...(appointment?.id && { id: appointment.id }), // Only include ID if editing existing
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
          <DialogDescription>
            {appointment ? 'Update your appointment details' : 'Create a new appointment'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {conflictError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              ⚠️ {conflictError}
            </div>
          )}
          <div>
            <Label htmlFor="title">Appointment Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Client Meeting, Follow-up Call"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
                className="mt-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
                <SelectTrigger id="type" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="duration">Duration (hours)</Label>
              <Input
                id="duration"
                name="duration"
                type="number"
                min="0.5"
                step="0.5"
                value={formData.duration}
                onChange={handleChange}
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Conference Room, Zoom link"
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Additional details about this appointment"
              className="mt-2"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Private notes for this appointment"
              className="mt-2"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {appointment && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm('Delete this appointment?')) {
                    onDelete(appointment.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Appointment'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentModal;
