import React from 'react';
import { StatusText } from '../utils/taskUtils';
import { tasks, TaskStatus } from '../api/api';
import { useTaskStore } from '../stores/taskStore';

interface StatusSelectionModalProps {
  taskId: number;
  currentStatus: TaskStatus;
  onClose: () => void;
}

const StatusSelectionModal: React.FC<StatusSelectionModalProps> = ({ taskId, currentStatus, onClose }) => {
  const { fetchProjects } = useTaskStore();

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await tasks.update(taskId, { status: newStatus });
      await fetchProjects(); // Refresh the tasks after update
      onClose();
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Select Status</h3>
        <div className="space-y-2">
          {(Object.keys(StatusText) as TaskStatus[]).map((status) => (
            <button
              key={status}
              className={`w-full text-left p-2 rounded ${
                currentStatus === status ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'
              }`}
              onClick={() => handleStatusChange(status)}
            >
              <input
                type="radio"
                checked={currentStatus === status}
                readOnly
                className="mr-2"
              />
              {StatusText[status]}
            </button>
          ))}
        </div>
        <button
          className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default StatusSelectionModal;
