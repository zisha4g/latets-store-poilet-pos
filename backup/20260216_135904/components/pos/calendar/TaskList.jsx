import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Circle, Trash2, Edit, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TaskList = ({ tasks = [], onEditTask, onDeleteTask, onUpdateTask }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, pending, in_progress, completed
  const [filterPriority, setFilterPriority] = useState('all'); // all, low, medium, high, urgent
  const [sortBy, setSortBy] = useState('due_date'); // due_date, priority, status

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Search
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    // Filter by priority
    if (filterPriority !== 'all') {
      filtered = filtered.filter(task => task.priority === filterPriority);
    }

    // Sort
    if (sortBy === 'due_date') {
      filtered.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    } else if (sortBy === 'priority') {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      filtered.sort((a, b) => (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4));
    } else if (sortBy === 'status') {
      const statusOrder = { pending: 0, in_progress: 1, completed: 2 };
      filtered.sort((a, b) => (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3));
    }

    return filtered;
  }, [tasks, searchTerm, filterStatus, filterPriority, sortBy]);

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-gray-500',
      in_progress: 'text-blue-500',
      completed: 'text-green-500 line-through',
    };
    return colors[status] || 'text-gray-500';
  };

  const isOverdue = (task) => {
    if (task.status === 'completed') return false;
    const dueDate = new Date(task.due_date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const toggleTaskCompletion = (task) => {
    onUpdateTask({
      ...task,
      status: task.status === 'completed' ? 'pending' : 'completed',
    });
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-hidden">
      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due_date">Due Date</SelectItem>
            <SelectItem value="priority">Priority</SelectItem>
            <SelectItem value="status">Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks List */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-2">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <Card 
                key={task.id}
                className={`cursor-pointer transition hover:shadow-md ${
                  isOverdue(task) && task.status !== 'completed' ? 'border-red-300 bg-red-50' : ''
                }`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => toggleTaskCompletion(task)}
                      className="mt-1 flex-none hover:opacity-70 transition"
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={`font-semibold text-lg ${getStatusColor(task.status)}`}>
                          {task.title}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.category && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {task.category}
                          </span>
                        )}
                        {isOverdue(task) && task.status !== 'completed' && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                            OVERDUE
                          </span>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        {task.assignee && <span>Assigned to: {task.assignee}</span>}
                        {task.estimated_hours && <span>Est: {task.estimated_hours}h</span>}
                        {task.status && (
                          <span className="capitalize">Status: {task.status.replace('_', ' ')}</span>
                        )}
                      </div>

                      {task.tags && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {task.tags.split(',').map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 rounded text-xs bg-muted">
                              #{tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 flex-none">
                      {task.status !== 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:bg-green-100 hover:text-green-700"
                          onClick={() => toggleTaskCompletion(task)}
                          title="Mark task as done"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Mark Done
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTask(task)}
                        title="Edit task"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-100 hover:text-red-700"
                        onClick={() => onDeleteTask(task.id)}
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No tasks found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskList;
