
"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 3 // Allow up to 3 toasts
const TOAST_REMOVE_DELAY = 5000 // Remove toast after 5 seconds

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
     // Clear existing timeout if the toast is updated or dismissed again
    clearTimeout(toastTimeouts.get(toastId));
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
       // If we are adding a new toast and limit is reached, remove the oldest one that is not open
       const toasts = [...state.toasts];
       if (toasts.length >= TOAST_LIMIT) {
           // Find the index of the oldest toast that is not currently open (being dismissed)
           let oldestClosedIndex = -1;
           for (let i = toasts.length - 1; i >= 0; i--) {
               if (!toasts[i].open) {
                   oldestClosedIndex = i;
                   break;
               }
           }
            // If all are open, remove the actual oldest one
           const indexToRemove = oldestClosedIndex !== -1 ? oldestClosedIndex : toasts.length - 1;
           const removedToastId = toasts[indexToRemove].id;
           toasts.splice(indexToRemove, 1);
           // Clear its timeout if it exists
           if (toastTimeouts.has(removedToastId)) {
              clearTimeout(toastTimeouts.get(removedToastId));
              toastTimeouts.delete(removedToastId);
           }
       }

      return {
        ...state,
        toasts: [action.toast, ...toasts], // Add new toast to the beginning
      }

    case "UPDATE_TOAST":
      // When updating, ensure the toast timeout is reset if necessary
       if (action.toast.id && action.toast.open !== false) { // Only reset timeout if it's not being dismissed
          addToRemoveQueue(action.toast.id);
       }
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        // Dismiss all toasts
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false, // Set open to false to trigger dismiss animation
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      // Clear timeout just in case before removing
       if (action.toastId && toastTimeouts.has(action.toastId)) {
          clearTimeout(toastTimeouts.get(action.toastId));
          toastTimeouts.delete(action.toastId);
       }

      if (action.toastId === undefined) {
        // Remove all toasts and clear all timeouts
         toastTimeouts.forEach(timeout => clearTimeout(timeout));
         toastTimeouts.clear();
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: Partial<ToasterToast>) => // Allow partial updates
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) {
           // Start the remove queue only when the close animation finishes
           addToRemoveQueue(id);
        } else {
            // If it's opened again (e.g., manually), clear the remove timeout
             if (toastTimeouts.has(id)) {
                 clearTimeout(toastTimeouts.get(id));
                 toastTimeouts.delete(id);
             }
        }
      },
    },
  })

   // Add to remove queue immediately when the toast is added
   addToRemoveQueue(id);


  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }

