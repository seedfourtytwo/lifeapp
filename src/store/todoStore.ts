/**
 * Todo Store
 * Manages todo items using Zustand
 */

import { create } from 'zustand';
import { Todo } from '../types';
import * as storage from '../services/storageService';

interface TodoState {
  // State
  todos: Todo[];
  activeTodos: Todo[];
  completedTodos: Todo[];
  isLoading: boolean;
  showHistory: boolean;

  // Actions
  loadTodos: () => Promise<void>;
  loadActiveTodos: () => Promise<void>;
  loadCompletedTodos: (daysBack?: number) => Promise<void>;
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'completed' | 'completedAt'>) => Promise<void>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleTodoComplete: (id: string) => Promise<void>;
  setShowHistory: (show: boolean) => void;
}

export const useTodoStore = create<TodoState>((set, get) => ({
  // Initial state
  todos: [],
  activeTodos: [],
  completedTodos: [],
  isLoading: false,
  showHistory: false,

  // Load all todos from storage
  loadTodos: async () => {
    set({ isLoading: true });
    try {
      const todos = await storage.getTodos();
      set({ todos, isLoading: false });
    } catch (error) {
      console.error('Failed to load todos:', error);
      set({ isLoading: false });
    }
  },

  // Load active (incomplete) todos
  loadActiveTodos: async () => {
    set({ isLoading: true });
    try {
      const activeTodos = await storage.getActiveTodos();
      set({ activeTodos, isLoading: false });
    } catch (error) {
      console.error('Failed to load active todos:', error);
      set({ isLoading: false });
    }
  },

  // Load completed todos (last 30 days by default)
  loadCompletedTodos: async (daysBack = 30) => {
    set({ isLoading: true });
    try {
      const completedTodos = await storage.getCompletedTodos(daysBack);
      set({ completedTodos, isLoading: false });
    } catch (error) {
      console.error('Failed to load completed todos:', error);
      set({ isLoading: false });
    }
  },

  // Add new todo
  addTodo: async (todoData) => {
    try {
      const newTodo: Todo = {
        ...todoData,
        id: storage.generateId(),
        createdAt: new Date().toISOString(),
        completed: false,
        points: todoData.points ?? 5, // Default to 5 points
      };

      await storage.addTodo(newTodo);

      // Reload active todos from storage (source of truth)
      const activeTodos = await storage.getActiveTodos();
      set({ activeTodos });
    } catch (error) {
      console.error('Failed to add todo:', error);
      throw error;
    }
  },

  // Update todo
  updateTodo: async (id, updates) => {
    try {
      await storage.updateTodo(id, updates);

      // Reload from storage
      const activeTodos = await storage.getActiveTodos();
      const completedTodos = await storage.getCompletedTodos();
      set({ activeTodos, completedTodos });
    } catch (error) {
      console.error('Failed to update todo:', error);
      throw error;
    }
  },

  // Delete todo
  deleteTodo: async (id) => {
    try {
      await storage.deleteTodo(id);

      // Reload from storage
      const activeTodos = await storage.getActiveTodos();
      const completedTodos = await storage.getCompletedTodos();
      set({ activeTodos, completedTodos });
    } catch (error) {
      console.error('Failed to delete todo:', error);
      throw error;
    }
  },

  // Toggle todo completion status
  toggleTodoComplete: async (id) => {
    try {
      const { activeTodos, completedTodos } = get();
      const todo = [...activeTodos, ...completedTodos].find((t) => t.id === id);

      if (!todo) {
        console.warn('Todo not found:', id);
        return;
      }

      const updates: Partial<Todo> = {
        completed: !todo.completed,
        completedAt: !todo.completed ? new Date().toISOString() : undefined,
      };

      await storage.updateTodo(id, updates);

      // Reload from storage
      const updatedActiveTodos = await storage.getActiveTodos();
      const updatedCompletedTodos = await storage.getCompletedTodos();
      set({ activeTodos: updatedActiveTodos, completedTodos: updatedCompletedTodos });
    } catch (error) {
      console.error('Failed to toggle todo completion:', error);
      throw error;
    }
  },

  // Toggle history view
  setShowHistory: (show) => {
    set({ showHistory: show });
  },
}));
