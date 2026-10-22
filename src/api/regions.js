/**
 * api/regions.js — calls to the Rust group/frame ("region") commands.
 * Rust side: src-tauri/src/commands/regions.rs
 */
import { invoke } from '@tauri-apps/api/core';

export const listRegions = () => invoke('list_regions');
export const saveRegion = (region) => invoke('save_region', { region });
export const deleteRegion = (id) => invoke('delete_region', { id });
