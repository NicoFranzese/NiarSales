import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AgentRunRequest { rubro: string; localidad: string; cantidad: number; }
@Injectable({ providedIn: 'root' })
export class AgentService {
  private http=inject(HttpClient);
  run(data:AgentRunRequest,csrfToken:string):Observable<any>{
    return this.http.post<any>('/api/agent/run',data,{
      withCredentials:true,
      headers:new HttpHeaders({'X-CSRF-Token':csrfToken})
    });
  }
}
