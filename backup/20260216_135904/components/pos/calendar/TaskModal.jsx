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

const TaskModal = ({ isOpen, onClose, task, selectedDate, onSave, onDelete }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: selectedDate.toISOString().split('T')[0],
    priority: 'medium', // low, medium, high, urgent
    status: 'pending', // pending, in_progress, completed
    category: '', // work, personal, sales, customer_service, etc
    assignee: '',
    estimated_hours: '',
    tags: '',
  });

  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        due_date: task.due_date?.split('T')[0] || selectedDate.toISOString().split('T')[0],
      });
    } else {
      setFormData(prev => ({
        ...prev,
        due_date: selectedDate.toISOString().split('T')[0],
      }));
    }
  }, [task, selectedDate, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      alert('Please enter a task title');
      return;
    }
    // Don't include temp ID - let database generate UUID
    // Convert empty estimated_hours to null
    onSave({
      ...formData,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      ...(task?.id && { id: task.id }), // Only include ID if editing existing
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update your task details' : 'Create a new task or todo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="title">Task Title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Follow up with customer, Prepare report"
              className="mt-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                name="due_date"
                type="date"
                value={formData.due_date}
                onChange={handleChange}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger id="priority" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger id="status" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
                <SelectTrigger id="category" className="mt-2">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="customer_service">Customer Service</SelectItem>
                  <SelectItem value="inventory">Inventory</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee">Assign To</Label>
              <Input
                id="assignee"
                name="assignee"
                value={formData.assignee}
                onChange={handleChange}
                placeholder="Your name or team member"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="estimated_hours">Est. Hours</Label>
              <Input
                id="estimated_hours"
                name="estimated_hours"
                type="number"
                min="0"
                step="0.5"
                value={formData.estimated_hours}
                onChange={handleChange}
                placeholder="e.g., 2.5"
                className="mt-2"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Detailed description of the task"
              className="mt-2"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="e.g., urgent, important, follow-up"
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {task && (
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm('Delete this task?')) {
                    onDelete(task.id);
                  }
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Task
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;
