import React, { useState, useEffect } from 'react';
import { Bell, Send, Clock, CheckCircle, Plus, Trash2 } from 'lucide-react';
interface Notification {
  id: number;
  title: string;
  message: string;
  target: string;
  date: string;
  status: 'Sent' | 'Scheduled';
}
const initialNotifications: Notification[] = [
{
  id: 1,
  title: 'System Maintenance',
  message: 'LearnHub will be down for maintenance on Sunday at 2AM.',
  target: 'All Users',
  date: '2025-02-15',
  status: 'Sent'
},
{
  id: 2,
  title: 'New Course Available',
  message: 'Check out the new Leadership Training module.',
  target: 'Managers',
  date: '2025-02-18',
  status: 'Scheduled'
},
{
  id: 3,
  title: 'Compliance Reminder',
  message: 'Please complete your Data Privacy training by Friday.',
  target: 'All Employees',
  date: '2025-02-10',
  status: 'Sent'
}];

export function NotificationManagement() {
  const [notifications, setNotifications] =
  useState<Notification[]>(initialNotifications);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [departments, setDepartments] = useState<{id: number; name: string}[]>([]);

  // Load departments from API for target audience
  useEffect(() => {
    fetch('/api/departments')
      .then(res => res.json())
      .then(data => setDepartments(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load departments:', err));
  }, []);
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setIsModalOpen(false);
    alert('Notification scheduled!');
  };
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          Notification System
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">

          <Plus className="h-4 w-4 mr-2" />
          Create Notification
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Target Audience
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {notifications.map((notification) =>
              <tr
                key={notification.id}
                className="hover:bg-slate-50 transition-colors">

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Bell className="h-5 w-5 text-slate-400 mr-3" />
                      <div className="text-sm font-medium text-slate-900">
                        {notification.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-500 truncate max-w-xs">
                      {notification.message}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {notification.target}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {notification.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${notification.status === 'Sent' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>

                      {notification.status === 'Sent' ?
                    <CheckCircle className="h-3 w-3 mr-1" /> :

                    <Clock className="h-3 w-3 mr-1" />
                    }
                      {notification.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-slate-400 hover:text-red-600">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Notification Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div
            className="fixed inset-0 transition-opacity"
            aria-hidden="true">

              <div className="absolute inset-0 bg-slate-500 opacity-75"></div>
            </div>
            <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true">

              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">
                  Send New Notification
                </h3>
                <form onSubmit={handleSend} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Title
                    </label>
                    <input
                    type="text"
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Notification subject" />

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Message
                    </label>
                    <textarea
                    rows={3}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
                    placeholder="Type your message here..." />

                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Target Audience
                    </label>
                    <select className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm">
                      <option>All Users</option>
                      <option>All Employees</option>
                      <option>All Admins</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.name}>{dept.name} Department</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-slate-300 rounded" />

                    <label className="ml-2 block text-sm text-slate-900">
                      Schedule for later
                    </label>
                  </div>
                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                    <button
                    type="submit"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:col-start-2 sm:text-sm">

                      <Send className="h-4 w-4 mr-2" />
                      Send Notification
                    </button>
                    <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:col-start-1 sm:text-sm">

                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }
    </div>);

}
