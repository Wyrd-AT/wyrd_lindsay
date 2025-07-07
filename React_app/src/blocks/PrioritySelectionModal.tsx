import React from 'react';
import { tasks } from '../api/api';
import { useTaskStore } from '../stores/taskStore';
import { getPriorityColor } from '../utils/taskUtils';

interface PrioritySelectionModalProps {
  taskId: number;
  currentPriority: number | null;
  onClose: () => void;
}

const PrioritySelectionModal: React.FC<PrioritySelectionModalProps> = ({ taskId, currentPriority, onClose }) => {
  const { fetchProjects } = useTaskStore();

  const handlePriorityChange = async (newPriority: number) => {
    try {
      await tasks.update(taskId, { priority: newPriority });
      await fetchProjects(); // Refresh the tasks after update
      onClose();
    } catch (error) {
      console.error('Failed to update task priority:', error);
    }
  };

  const effectiveCurrentPriority = currentPriority === null ? 0 : currentPriority;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-semibold mb-4">Select Priority</h3>
        <div className="flex justify-between">
          {[0, 1, 2, 3, 4, 5].map((priority) => (
            <button
              key={priority}
              className={`w-12 h-12 rounded-full ${getPriorityColor(priority)} border border-gray-300 flex items-center justify-center ${
                effectiveCurrentPriority === priority ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => handlePriorityChange(priority)}
            >
              <span className="text-gray-800 font-semibold">{priority}</span>
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

export default PrioritySelectionModal;
