import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProspectActivity {
  id:number; prospecto_id:number; tipo:string; canal:string; resultado:string|null;
  detalle:string|null; mensaje:string|null; proximo_contacto:string|null; created_at:string;
}
export interface Prospect {
  id: number; nombre: string; google_place_id?: string | null; google_maps_url?: string | null; razon_social?: string | null; rubro_id?: number | null;
  fuente_id?: number | null; telefono?: string | null; telefono_original?: string | null; telefono_tipo?: 'celular' | 'fijo' | 'desconocido' | null; email?: string | null;
  sitio_web?: string | null; instagram?: string | null; facebook?: string | null;
  direccion?: string | null; localidad?: string | null; provincia?: string | null;
  estado?: string; prioridad?: string; score?: number | null; mensaje_sugerido_ia?: string | null; notas?: string | null;
}
@Injectable({ providedIn: 'root' })
export class ProspectService {
  private http = inject(HttpClient);
  private base = '/api/prospects';
  list(filters: Record<string, string | number>): Observable<any> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k,v]) => { if (String(v).trim()) params = params.set(k,String(v)); });
    return this.http.get<any>(this.base,{params,withCredentials:true});
  }
  detail(id:number): Observable<any> { return this.http.get<any>(`${this.base}/${id}`,{withCredentials:true}); }
  reviewSummary(id:number): Observable<any> { return this.http.get<any>(`${this.base}/${id}/review-summary`,{withCredentials:true}); }
  activities(id:number): Observable<any> { return this.http.get<any>(`${this.base}/${id}/activities`,{withCredentials:true}); }
  addActivity(id:number,data:Partial<ProspectActivity>,csrf:string): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/activities`,data,{withCredentials:true,headers:new HttpHeaders({'X-CSRF-Token':csrf})});
  }
  catalogs(): Observable<any> { return this.http.get<any>(`${this.base}/catalogs`,{withCredentials:true}); }
  create(data: Partial<Prospect>, csrf: string): Observable<any> {
    return this.http.post<any>(this.base,data,{withCredentials:true,headers:new HttpHeaders({'X-CSRF-Token':csrf})});
  }
  update(id:number,data:Partial<Prospect>,csrf:string): Observable<any> {
    return this.http.put<any>(`${this.base}/${id}`,data,{withCredentials:true,headers:new HttpHeaders({'X-CSRF-Token':csrf})});
  }
}
