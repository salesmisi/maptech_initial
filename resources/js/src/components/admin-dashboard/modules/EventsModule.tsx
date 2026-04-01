import React, { useState } from 'react';
import { Calendar, Clock, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { ModuleProps } from '../types';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  description: string;
  category: 'meeting' | 'deadline' | 'training' | 'other';
}

const categoryColors = {
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  deadline: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  training: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export function EventsModule({ config, onUpdate, onRemove }: ModuleProps) {
  const [events, setEvents] = useState<Event[]>(
    config.settings?.events || [
      {
        id: '1',
        title: 'Quarterly Review Meeting',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        description: 'Review Q1 performance metrics and discuss objectives for Q2',
        category: 'meeting',
      },
      {
        id: '2',
        title: 'Project Alpha Deadline',
        date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        time: '05:00 PM',
        description: 'Final submission for Project Alpha deliverables',
        category: 'deadline',
      },
      {
        id: '3',
        title: 'New Employee Orientation',
        date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
        time: '09:00 AM',
        description: 'Welcome and onboarding session for new team members',
        category: 'training',
      },
    ]
  );
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(config.title);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    time: '12:00 PM',
    description: '',
    category: 'other',
  });

  const handleTitleSave = () => {
    onUpdate({ title: editedTitle });
    setIsEditingTitle(false);
  };

  const handleAddEvent = () => {
    if (newEvent.title && newEvent.date && newEvent.time && newEvent.description) {
      const event: Event = {
        id: Date.now().toString(),
        title: newEvent.title,
        date: newEvent.date,
        time: newEvent.time,
        description: newEvent.description,
        category: newEvent.category as Event['category'],
      };
      const updatedEvents = [...events, event];
      setEvents(updatedEvents);
      onUpdate({ settings: { ...config.settings, events: updatedEvents } });
      setIsAddingEvent(false);
      setNewEvent({
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00 PM',
        description: '',
        category: 'other',
      });
    }
  };

  const handleDeleteEvent = (id: string) => {
    const updatedEvents = events.filter(e => e.id !== id);
    setEvents(updatedEvents);
    onUpdate({ settings: { ...config.settings, events: updatedEvents } });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 p-4">
        <div className="flex items-center justify-between">
          {isEditingTitle ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyPress={(e) => e.key === 'Enter' && handleTitleSave()}
              className="bg-white/20 text-white px-2 py-1 rounded border border-white/30 focus:outline-none focus:border-white flex-1"
              autoFocus
            />
          ) : (
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {config.title}
              <button
                onClick={() => setIsEditingTitle(true)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </h3>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setIsAddingEvent(true)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              title="Add event"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={onRemove}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
              title="Remove module"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Event Form */}
      {isAddingEvent && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">Add New Event</h4>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Event title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
              <input
                type="time"
                value={newEvent.time}
                onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <select
              value={newEvent.category}
              onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as Event['category'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="meeting">Meeting</option>
              <option value="deadline">Deadline</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
            <textarea
              placeholder="Event description"
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddEvent}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Event
              </button>
              <button
                onClick={() => setIsAddingEvent(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="p-4 max-h-96 overflow-y-auto">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events scheduled</p>
            <button
              onClick={() => setIsAddingEvent(true)}
              className="mt-3 text-purple-600 dark:text-purple-400 hover:underline"
            >
              Add your first event
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEvents.map(event => (
              <div
                key={event.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">{event.title}</h4>
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(event.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {event.time}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{event.description}</p>
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${categoryColors[event.category]}`}>
                  {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
