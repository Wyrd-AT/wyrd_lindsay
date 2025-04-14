import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { X, Check, AlertCircle, Info } from 'lucide-react';
import { tasks } from '../api/api';
import { useTaskStore } from '../stores/taskStore';

interface UserPermissionsModalProps {
  taskId: number;
  role: 'EXECUTOR' | 'STAKEHOLDER';
  onClose: () => void;
  onUpdate: () => void;
}

interface User {
  id: number;
  name: string;
  email: string;
}

const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
  taskId,
  role,
  onClose,
  onUpdate
}) => {
  const { registeredUsers, fetchRegisteredUsers } = useAuthStore();
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { projects } = useTaskStore();
  const [taskPermissions, setTaskPermissions] = useState<{[key: number]: string[]}>({});
  const [ownerName, setOwnerName] = useState<string>('');
  const [executorName, setExecutorName] = useState<string>('');

  useEffect(() => {
    fetchRegisteredUsers();
    // Initialize selected users and task permissions based on current task permissions
    const task = Object.values(projects).flat().find(t => t.id === taskId);
    if (task) {
      const initialSelected = new Set(
        task.userPermissions
          .filter(perm => perm.role === role)
          .map(perm => perm.userId)
      );
      setSelectedUsers(initialSelected);

      const permissions: {[key: number]: string[]} = {};
      task.userPermissions.forEach(perm => {
        if (!permissions[perm.userId]) {
          permissions[perm.userId] = [];
        }
        permissions[perm.userId].push(perm.role);
        if (perm.role === 'OWNER') {
          setOwnerName(perm.name);
        } else if (perm.role === 'EXECUTOR') {
          setExecutorName(perm.name);
        }
      });
      setTaskPermissions(permissions);
    }
  }, [fetchRegisteredUsers, taskId, role, projects]);

  const handleUserToggle = async (userId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const newRole = selectedUsers.has(userId) ? 'NONE' : role;
      await tasks.updatePermission(taskId, userId, newRole);
      setSelectedUsers(prev => {
        const newSet = new Set(prev);
        if (newSet.has(userId)) {
          newSet.delete(userId);
        } else {
          newSet.add(userId);
        }
        return newSet;
      });
      setTaskPermissions(prev => {
        const newPermissions = { ...prev };
        if (newRole === 'NONE') {
          newPermissions[userId] = newPermissions[userId].filter(r => r !== role);
        } else {
          if (!newPermissions[userId]) {
            newPermissions[userId] = [];
          }
          if (!newPermissions[userId].includes(role)) {
            newPermissions[userId].push(role);
          }
        }
        return newPermissions;
      });
      onUpdate();
      
      // Update owner or executor name if necessary
      if (role === 'EXECUTOR') {
        setExecutorName(newRole === 'NONE' ? '' : registeredUsers.find(u => u.id === userId)?.name || '');
      }
    } catch (error) {
      console.error('Failed to update permission:', error);
      setError('Failed to update permission. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonStyle = (userId: number) => {
    const userRoles = taskPermissions[userId] || [];
    if (userRoles.includes('OWNER') || userRoles.includes('EXECUTOR')) {
      return 'bg-green-100 text-green-800 hover:bg-green-200';
    }
    return selectedUsers.has(userId)
      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      : 'bg-gray-100 text-gray-800 hover:bg-gray-200';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">
            {role === 'EXECUTOR' ? 'Assign Executor' : 'Manage Stakeholders'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>
        <div className="mb-4 text-sm text-gray-600 flex items-start">
          <Info size={16} className="mr-2 mt-1 flex-shrink-0" />
          <p>
            <strong>Task Owner:</strong> {ownerName || 'Not assigned'}
            <br />
            <strong>Assigned to:</strong> {executorName || 'Not assigned'}
          </p>
        </div>
        <div className="mb-4 flex-grow overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {registeredUsers.map((user: User) => (
              <button
                key={user.id}
                onClick={() => handleUserToggle(user.id)}
                disabled={isLoading}
                className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${getButtonStyle(user.id)}`}
              >
                <span>{user.name}</span>
                {(selectedUsers.has(user.id) || (taskPermissions[user.id] && taskPermissions[user.id].includes('STAKEHOLDER'))) && (
                  <Check size={16} className="ml-2" />
                )}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <div className="mb-4 text-red-500 flex items-center">
            <AlertCircle size={16} className="mr-2" />
            <span>{error}</span>
          </div>
        )}
        {isLoading && (
          <div className="text-center text-gray-500">
            Updating permissions...
          </div>
        )}
      </div>
    </div>
  );
};

export default UserPermissionsModal;
