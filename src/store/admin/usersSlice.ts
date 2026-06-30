import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { usersApi } from '@/api/users';
import type {
  UserDto,
  CreateUserPayload,
  UpdateUserPayload,
  UsersListParams,
} from '@/types/user.types';
import type { PaginatedResponse } from '@/types/common.types';
import type { UserModules } from '@/types';

interface UsersState {
  list: UserDto[];
  loading: boolean;
  error: string | null;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  search: string;
}

const initialState: UsersState = {
  list: [],
  loading: false,
  error: null,
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 0,
  search: '',
};

export const fetchUsers = createAsyncThunk<PaginatedResponse<UserDto>, UsersListParams | undefined>(
  'users/fetchAll',
  (params) => usersApi.list(params),
);

export const createUser = createAsyncThunk(
  'users/create',
  (payload: CreateUserPayload) => usersApi.create(payload),
);

export const updateUser = createAsyncThunk(
  'users/update',
  ({ id, payload }: { id: string; payload: UpdateUserPayload }) => usersApi.update(id, payload),
);

export const updateUserModules = createAsyncThunk(
  'users/updateModules',
  ({ id, modules }: { id: string; modules: UserModules }) => usersApi.updateModules(id, modules),
);

export const resetUserPassword = createAsyncThunk(
  'users/resetPassword',
  async ({ id, newPassword }: { id: string; newPassword: string }) => {
    await usersApi.resetPassword(id, newPassword);
  },
);

export const deleteUser = createAsyncThunk('users/delete', async (id: string) => {
  await usersApi.delete(id);
  return id;
});

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload.data;
        state.total = action.payload.total;
        state.page = action.payload.page;
        state.limit = action.payload.limit;
        state.totalPages = action.payload.totalPages;
        state.search = action.meta.arg?.search?.trim() ?? '';
      })
      .addCase(fetchUsers.rejected, (state, action) => { state.loading = false; state.error = action.error.message ?? 'Error'; })
      .addCase(updateUser.fulfilled, (state, action) => {
        const idx = state.list.findIndex((u) => u.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(updateUserModules.fulfilled, (state, action) => {
        const idx = state.list.findIndex((u) => u.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.list = state.list.filter((u) => u.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        state.totalPages = Math.ceil(state.total / state.limit);
      });
  },
});

export default usersSlice.reducer;
