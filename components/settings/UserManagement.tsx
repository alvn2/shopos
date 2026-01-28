import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { api } from '../../services/api';
import { Plus, Edit2, Trash2, X, Check, Loader2, User as UserIcon } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form State
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    role: UserRole.COUNTER
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.users.getAll();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user.username);
      setFormData({
        username: user.username,
        password: '', // Don't fill password
        full_name: user.full_name,
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        password: '',
        full_name: '',
        role: UserRole.COUNTER
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingUser) {
        // Update logic
        const updates: any = { 
          full_name: formData.full_name,
          role: formData.role
        };
        if (formData.password) updates.password = formData.password; // Mock password update
        await api.users.update(editingUser, updates);
      } else {
        // Create logic
        await api.users.create(formData);
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (e) {
      alert('Operation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!window.confirm(`Are you sure you want to delete ${username}?`)) return;
    try {
      await api.users.delete(username);
      fetchUsers();
    } catch (e) {
      alert('Delete failed');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 space-y-4">
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">User Management</h3>
        <button 
          onClick={() => openModal()}
          className="p-2 bg-brand-50 text-brand-600 rounded-full hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300 transition-colors"
        >
          <Plus size={18} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-500"><Loader2 className="animate-spin inline mr-2"/> Loading users...</div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.username} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-300">
                  <UserIcon size={16} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                  <div className="text-xs text-gray-500 flex items-center space-x-2">
                    <span className="bg-gray-200 dark:bg-gray-600 px-1.5 rounded text-[10px] uppercase">{user.role}</span>
                    <span>@{user.username}</span>
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => openModal(user)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                {user.username !== 'admin' && (
                  <button 
                    onClick={() => handleDelete(user.username)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-up">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-gray-900 dark:text-white">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={formData.username}
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-1 focus:ring-brand-500 outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  className="w-full p-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-sm dark:text-white focus:ring-1 focus:ring-brand-500 outline-none"
                >
                  <option value={UserRole.COUNTER}>Counter</option>
                  <option value={UserRole.ADMIN}>Admin</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full py-2 bg-brand-600 text-white rounded-lg font-bold shadow-md hover:bg-brand-700 active:scale-95 transition-all flex items-center justify-center"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : (
                    <>
                      <Check size={18} className="mr-2" />
                      Save User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;