import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AddTask from '../AddTask'

import * as taskStoreModule from '../../stores/taskStore'

vi.mock("../../api/api")
vi.mock('../../stores/taskStore')

describe('AddTask', () => {
  const mockOnClose = vi.fn()
  const mockOnAddTask = vi.fn()
  const mockUpdateStore = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(taskStoreModule, 'useTaskStore').mockReturnValue({ updateStore: mockUpdateStore })
  })

  it('renders correctly', () => {
    render(<AddTask onClose={mockOnClose} onAddTask={mockOnAddTask} project="" />)
    expect(screen.getByText('Add New Task')).toBeInTheDocument()
    expect(screen.getByLabelText('Project *')).toBeInTheDocument()
    expect(screen.getByLabelText('Task Title *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Deadline')).toBeInTheDocument()
  })

})



