'use client';
import { useCallback, useSyncExternalStore } from "react";
interface StoreClosedState {
    isOpen: boolean;
    availableFrom: string;
    availableTo: string;
}
let state: StoreClosedState = {
    isOpen: false,
    availableFrom: "",
    availableTo: "",
};
let listeners: Array<() => void> = [];
function emitChange() {
    for (const listener of listeners) {
        listener();
    }
}
function subscribe(listener: () => void) {
    listeners = [...listeners, listener];
    return () => {
        listeners = listeners.filter((l) => l !== listener);
    };
}
function getSnapshot() {
    return state;
}
function getServerSnapshot() {
    return { isOpen: false, availableFrom: "", availableTo: "" };
}
export function openStoreClosedModal(availableFrom: string, availableTo: string) {
    state = { isOpen: true, availableFrom, availableTo };
    emitChange();
}
export function closeStoreClosedModal() {
    state = { isOpen: false, availableFrom: "", availableTo: "" };
    emitChange();
}
export function useStoreClosedModal() {
    const currentState = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const open = useCallback((availableFrom: string, availableTo: string) => {
        openStoreClosedModal(availableFrom, availableTo);
    }, []);
    const close = useCallback(() => {
        closeStoreClosedModal();
    }, []);
    return {
        isOpen: currentState.isOpen,
        availableFrom: currentState.availableFrom,
        availableTo: currentState.availableTo,
        open,
        close,
    };
}
