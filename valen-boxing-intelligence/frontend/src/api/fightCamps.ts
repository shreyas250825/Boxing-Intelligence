import apiClient from './client'
import type { FightCamp, SingleResponse } from '../types'

export const listFightCamps = (boxerId: string) =>
  apiClient.get<SingleResponse<FightCamp[]>>(`/api/v1/boxers/${boxerId}/fight-camps`).then(r => r.data.data)

export const createFightCamp = (data: Partial<FightCamp> & { boxer_id: string }) =>
  apiClient.post<SingleResponse<FightCamp>>('/api/v1/fight-camps', data).then(r => r.data.data)

export const getFightCamp = (id: string) =>
  apiClient.get<SingleResponse<FightCamp>>(`/api/v1/fight-camps/${id}`).then(r => r.data.data)

export const updateFightCamp = (id: string, data: Partial<FightCamp>) =>
  apiClient.put<SingleResponse<FightCamp>>(`/api/v1/fight-camps/${id}`, data).then(r => r.data.data)
