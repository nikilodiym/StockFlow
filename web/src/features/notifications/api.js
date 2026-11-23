import { request } from "../../shared/api/client";

export const markRead = (id) => request(`/notifications/${id}/read/`, { method: "POST" });
