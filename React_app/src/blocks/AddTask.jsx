import * as React from "react"
import { useState, useEffect } from "react";
import { Button } from "@/assets/ui/button";
import { Input } from "@/assets/ui/input";
import { Label } from "@/assets/ui/label";
import { Textarea } from "@/assets/ui/textarea";
import { createTask } from "../api/api";
import { useTaskStore } from '../stores/taskStore';

function AddTask({ onClose, project }) {
  const updateStore = useTaskStore((state) => state.updateStore);
  const [currentProject, setCurrentProject] = useState(project || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    try {
      const newTask = {
        title,
        project: currentProject,
        description,
        status: 'TO_DO',
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
      };

      await createTask(newTask);
      await updateStore(); 
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || "Failed to add task");
      } else {
        setError("An unexpected error occurred");
      }
    }
  };

  const validateForm = () => {
    if (currentProject.length < 1) {
      setError("Project is required");
      return false;
    }
    if (title.length < 3) {
      setError("Task Title must be at least 3 characters long");
      return false;
    }
    return true;
  };

  const formFields = [
    {
      id: "project",
      label: "Project *",
      type: "text",
      value: currentProject,
      onChange: setCurrentProject,
      required: true,
      disabled: !!project
    },
    {
      id: "title",
      label: "Task Title *",
      type: "text",
      value: title,
      onChange: setTitle,
      required: true,
      minLength: 3
    },
    {
      id: "description",
      label: "Description",
      type: "textarea",
      value: description,
      onChange: setDescription,
      rows: 3
    },
    {
      id: "deadline",
      label: "Deadline",
      type: "datetime-local",
      value: deadline,
      onChange: setDeadline
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg w-full max-w-md mx-4">
        <h2 className="text-2xl font-bold mb-4">Add New Task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields.map((field) => (
            <div key={field.id}>
              <Label htmlFor={field.id}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={field.id}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  rows={field.rows}
                />
              ) : (
                <Input
                  id={field.id}
                  type={field.type}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  required={field.required}
                  minLength={field.minLength}
                  disabled={field.disabled}
                />
              )}
            </div>
          ))}
          {error && <p className="text-red-500">{error}</p>}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Criar Teste</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTask;
