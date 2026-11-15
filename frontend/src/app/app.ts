import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './services/auth.service';
import { AgentService } from './services/agent.service';
import { ProspectService, Prospect, ProspectActivity } from './services/prospect.service';

interface AgentProspect {
  id:number|null; nombre:string; direccion:string; telefono:string|null; telefono_original?:string|null; telefono_tipo?:'celular'|'fijo'|'desconocido'|null; web:string|null;
  google_maps:string|null; score:number; prioridad:string; potencial:string;
  motivos:string[]; mensaje_sugerido:string;
}
@Component({
 selector:'app-root',standalone:true,imports:[FormsModule,CommonModule],templateUrl:'./app.html',styleUrl:'./app.scss'
})
export class App implements OnInit {
 readonly auth=inject(AuthService); private http=inject(HttpClient); private agent=inject(AgentService); private prospectService=inject(ProspectService);
 readonly loading=signal(true);readonly submitting=signal(false);readonly errorMessage=signal('');
 readonly successMessage=signal('');readonly results=signal<AgentProspect[]>([]);
 readonly executionSummary=signal<any>(null);readonly section=signal<'agent'|'prospects'|'clients'>('agent');
 readonly clients=signal<any[]>([]);readonly clientsLoading=signal(false);readonly clientsError=signal('');readonly selectedClient=signal<any|null>(null);readonly clientDetail=signal<any|null>(null);readonly clientSaving=signal(false);readonly clientMessage=signal('');readonly clientError=signal('');
 clientForm:any={nombre:'',razon_social:'',cuit:'',telefono:'',email:'',direccion:'',localidad:'',servicio:'MesAPP',abono_mensual:18000,fecha_alta:new Date().toISOString().slice(0,10),inicio_cobranzas:new Date().toISOString().slice(0,10),estado:'activo',observaciones:''};
 tariffForm:any={importe:18000,vigente_desde:new Date().toISOString().slice(0,10)}; chargeForm:any={periodo:new Date().toISOString().slice(0,7),vencimiento:new Date().toISOString().slice(0,10)}; paymentForm:any={cargo_id:0,importe:0,fecha_pago:new Date().toISOString().slice(0,10),medio:'transferencia',referencia:'',observaciones:''};
 readonly prospects=signal<Prospect[]>([]);readonly prospectsLoading=signal(false);readonly prospectsError=signal('');
 readonly prospectQuery=signal('');readonly prospectLocalidad=signal('');readonly prospectEstado=signal('');
 readonly prospectPrioridad=signal('');readonly prospectPage=signal(1);readonly prospectPages=signal(1);readonly prospectTotal=signal(0);
 readonly selectedProspect=signal<Prospect|null>(null);readonly activities=signal<ProspectActivity[]>([]);
 readonly reviewSummary=signal<any|null>(null);readonly reviewSummaryLoading=signal(false);readonly reviewSummaryError=signal('');readonly reviewSummaryMessage=signal('');
 readonly activityLoading=signal(false);readonly activitySaving=signal(false);readonly activityError=signal('');
 activityType='contacto';activityChannel='whatsapp';activityResult='';activityDetail='';activityMessage='';nextContact='';
 phoneTypeDraft:'celular'|'fijo'|'desconocido'='desconocido';readonly phoneTypeSaving=signal(false);
 phoneDraft='';
 statusSaving=signal(false);
 rubro='Pizzerías';localidad='Avellaneda';cantidad=5;
 email='';password='';showPassword=false;
 ngOnInit():void{this.auth.checkSession().subscribe({next:()=>this.loading.set(false),error:()=>this.loading.set(false)});}
 login():void{
  this.errorMessage.set('');
  if(!this.email.trim()||!this.password){this.errorMessage.set('Ingresá tu correo y contraseña.');return;}
  this.submitting.set(true);
  this.auth.login(this.email.trim(),this.password).subscribe({
   next:()=>this.submitting.set(false),
   error:(e:HttpErrorResponse)=>{this.submitting.set(false);this.errorMessage.set(e.error?.message||'No se pudo iniciar sesión.');}
  });
 }
 logout():void{this.auth.logout().subscribe();}
 runAgent():void{
  this.errorMessage.set('');this.successMessage.set('');this.results.set([]);this.executionSummary.set(null);
  if(!this.rubro.trim()||!this.localidad.trim()){this.errorMessage.set('Indicá un rubro y una localidad.');return;}
  this.submitting.set(true);
  this.agent.run({rubro:this.rubro.trim(),localidad:this.localidad.trim(),cantidad:this.cantidad},this.auth.getCsrfToken()).subscribe({
   next:(r:any)=>{this.submitting.set(false);this.results.set(r.data||[]);this.executionSummary.set(r);this.successMessage.set(r.message||'Investigación finalizada.');},
   error:(e:HttpErrorResponse)=>{this.submitting.set(false);this.errorMessage.set(e.error?.message||'No se pudo ejecutar el agente.');}
  });
 }
 showAgent():void{this.section.set('agent');}
 showProspects():void{this.section.set('prospects');this.loadProspects();}
 showClients():void{this.section.set('clients');this.loadClients();this.selectedClient.set(null);this.clientDetail.set(null);}
 hasBalance(v:any):boolean{return Number(v)>0;} hasPayments(v:any):boolean{return Number(v)>0;} 
 loadClients():void{this.clientsLoading.set(true);this.clientError.set('');this.http.get<any>('/api/clients',{withCredentials:true}).subscribe({next:r=>{this.clients.set(r.data||[]);this.clientsLoading.set(false)},error:e=>{this.clientsError.set(e.error?.message||'No se pudieron cargar los clientes.');this.clientsLoading.set(false)}})}
 newClient():void{this.selectedClient.set(null);this.clientDetail.set(null);this.clientMessage.set('');this.clientError.set('');this.clientForm={nombre:'',razon_social:'',cuit:'',telefono:'',email:'',direccion:'',localidad:'',servicio:'MesAPP',abono_mensual:18000,fecha_alta:new Date().toISOString().slice(0,10),inicio_cobranzas:new Date().toISOString().slice(0,10),estado:'activo',observaciones:''};}
 editClient(c:any):void{this.selectedClient.set(c);this.clientForm={...c};this.clientError.set('');this.tariffForm={importe:c.abono_mensual||18000,vigente_desde:new Date().toISOString().slice(0,10)};this.http.get<any>('/api/clients/'+c.id,{withCredentials:true}).subscribe({next:r=>this.clientDetail.set(r.data),error:e=>this.clientError.set(e.error?.message||'No se pudo abrir el cliente.')});}
 saveClient():void{if(!String(this.clientForm.nombre||'').trim()){this.clientError.set('El nombre comercial es obligatorio.');return;}this.clientSaving.set(true);this.clientError.set('');const c=this.selectedClient();const req=c?this.http.put<any>('/api/clients/'+c.id,this.clientForm,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}):this.http.post<any>('/api/clients',this.clientForm,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}});req.subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message||'Cliente guardado.');this.loadClients();if(r.id){const row={...this.clientForm,id:r.id};this.selectedClient.set(row);this.editClient(row)}},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo guardar el cliente.')}})}
 changeTariff():void{const c=this.selectedClient();if(!c)return;this.clientSaving.set(true);this.http.post<any>('/api/clients/'+c.id+'/tariffs',this.tariffForm,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message);this.editClient(c);this.loadClients()},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo actualizar la tarifa.')}})}
 deleteTariff(t:any):void{const c=this.selectedClient();if(!c)return;if(!confirm('¿Eliminar esta tarifa? Solo se podrá borrar si no tiene cargos asociados.'))return;this.clientSaving.set(true);this.clientError.set('');this.http.delete<any>('/api/clients/'+c.id+'/tariffs/'+t.id,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message||'Tarifa eliminada.');this.editClient(c);this.loadClients()},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo eliminar la tarifa.')}})}

 createCharge():void{const c=this.selectedClient();if(!c)return;this.clientSaving.set(true);this.http.post<any>('/api/clients/'+c.id+'/charges',this.chargeForm,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message);this.editClient(c)},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo generar el cargo.')}})}
 editCharge(x:any):void{const c=this.selectedClient();if(!c)return;const period=prompt('Período (AAAA-MM):',String(x.periodo||''));if(period===null)return;const due=prompt('Fecha de vencimiento (AAAA-MM-DD):',String(x.vencimiento||''));if(due===null)return;const amount=prompt('Importe del cargo ($):',String(x.importe||0));if(amount===null)return;if(!/^\d{4}-\d{2}$/.test(period.trim())||!/^\d{4}-\d{2}-\d{2}$/.test(due.trim())||!Number.isFinite(Number(amount))||Number(amount)<0){this.clientError.set('Revisá el período, vencimiento y el importe ingresados.');return;}this.clientSaving.set(true);this.clientError.set('');this.http.put<any>('/api/clients/'+c.id+'/charges/'+x.id,{periodo:period.trim(),vencimiento:due.trim(),importe:Number(amount)},{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message||'Cargo actualizado.');this.editClient(c);this.loadClients()},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo modificar el cargo.')}})}
 deleteCharge(x:any):void{const c=this.selectedClient();if(!c)return;if(!confirm('¿Eliminar el cargo de '+x.periodo+' por $'+Number(x.importe).toLocaleString('es-AR')+'? Esta acción no se puede deshacer.'))return;this.clientSaving.set(true);this.clientError.set('');this.http.delete<any>('/api/clients/'+c.id+'/charges/'+x.id,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message||'Cargo eliminado.');this.editClient(c);this.loadClients()},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo eliminar el cargo.')}})}
 recordClientPayment():void{const c=this.selectedClient();if(!c)return;this.clientSaving.set(true);this.http.post<any>('/api/clients/'+c.id+'/payments',this.paymentForm,{withCredentials:true,headers:{'X-CSRF-Token':this.auth.getCsrfToken()}}).subscribe({next:r=>{this.clientSaving.set(false);this.clientMessage.set(r.message);this.editClient(c);this.loadClients()},error:e=>{this.clientSaving.set(false);this.clientError.set(e.error?.message||'No se pudo registrar el pago.')}})}
 loadProspects(page=1):void{
  this.prospectsLoading.set(true);this.prospectsError.set('');
  const filters:Record<string,string|number>={page,per_page:15};
  if(this.prospectQuery().trim())filters['q']=this.prospectQuery().trim();
  if(this.prospectLocalidad().trim())filters['localidad']=this.prospectLocalidad().trim();
  if(this.prospectEstado())filters['estado']=this.prospectEstado();
  if(this.prospectPrioridad())filters['prioridad']=this.prospectPrioridad();
  this.prospectService.list(filters).subscribe({
   next:(r:any)=>{this.prospects.set(Array.isArray(r.data)?r.data:[]);this.prospectPage.set(Number(r.pagination?.page||1));this.prospectPages.set(Math.max(1,Number(r.pagination?.pages||1)));this.prospectTotal.set(Number(r.pagination?.total||0));this.prospectsLoading.set(false);},
   error:(e:HttpErrorResponse)=>{this.prospectsLoading.set(false);this.prospectsError.set(e.error?.message||'No se pudieron cargar los prospectos.');}
  });
 }
 searchProspects():void{this.loadProspects(1);}
 clearProspectFilters():void{this.prospectQuery.set('');this.prospectLocalidad.set('');this.prospectEstado.set('');this.prospectPrioridad.set('');this.loadProspects(1);}
 openProspect(p:Prospect):void{
  this.selectedProspect.set(p);this.activities.set([]);this.activityError.set('');this.activityLoading.set(true);
  this.reviewSummary.set(null);this.reviewSummaryError.set('');this.reviewSummaryMessage.set('');this.reviewSummaryLoading.set(false);
  this.activityType='contacto';this.activityChannel='whatsapp';this.activityResult='';this.activityDetail='';this.activityMessage=p.mensaje_sugerido_ia?.trim()||'';this.nextContact='';
  this.phoneTypeDraft=(p.telefono_tipo==='celular'||p.telefono_tipo==='fijo')?p.telefono_tipo:'desconocido';
  this.phoneDraft=p.telefono||p.telefono_original||'';
  this.prospectService.activities(p.id).subscribe({next:(r:any)=>{this.activities.set(Array.isArray(r.data)?r.data:[]);this.activityLoading.set(false);},error:(e:HttpErrorResponse)=>{this.activityError.set(e.error?.message||'No se pudo cargar el historial.');this.activityLoading.set(false);}});
 }
 closeProspect():void{this.selectedProspect.set(null);this.reviewSummary.set(null);}
 loadReviewSummary():void{const p=this.selectedProspect();if(!p||!p.google_place_id)return;this.reviewSummaryLoading.set(true);this.reviewSummaryError.set('');this.reviewSummaryMessage.set('');this.reviewSummary.set(null);this.prospectService.reviewSummary(p.id).subscribe({next:(r:any)=>{this.reviewSummaryLoading.set(false);this.reviewSummary.set(r.data||null);this.reviewSummaryMessage.set(r.message||'Consulta finalizada.');},error:(e:HttpErrorResponse)=>{this.reviewSummaryLoading.set(false);this.reviewSummaryError.set(e.error?.message||'No se pudo consultar Google.');}});}
 useSuggestedMessage():void{const p=this.selectedProspect();if(p?.mensaje_sugerido_ia)this.activityMessage=p.mensaje_sugerido_ia;}
 previousProspects():void{if(this.prospectPage()>1)this.loadProspects(this.prospectPage()-1);}
 nextProspects():void{if(this.prospectPage()<this.prospectPages())this.loadProspects(this.prospectPage()+1);}
 recordActivity():void{
  const p=this.selectedProspect();if(!p)return;
  if(!this.activityDetail.trim()&&!this.activityMessage.trim()){this.activityError.set('Escribí un detalle o mensaje para guardar el movimiento.');return;}
  this.activitySaving.set(true);this.activityError.set('');
  const payload={tipo:this.activityType,canal:this.activityChannel,resultado:this.activityResult,detalle:this.activityDetail,mensaje:this.activityMessage,proximo_contacto:this.nextContact};
  this.prospectService.addActivity(p.id,payload,this.auth.getCsrfToken()).subscribe({
   next:()=>{const newState=this.activityType==='contacto'?'contactado':this.activityType==='respuesta'?'respondio':this.activityType==='demostracion'?'demostracion_coordinada':p.estado;
    this.prospectService.update(p.id,{nombre:p.nombre,estado:newState},this.auth.getCsrfToken()).subscribe({next:()=>{this.activitySaving.set(false);this.activityDetail='';this.activityMessage='';this.activityResult='';this.nextContact='';this.refreshSelected(p.id);this.loadProspects(this.prospectPage());},error:()=>{this.activitySaving.set(false);this.refreshSelected(p.id);this.loadProspects(this.prospectPage());}});
   },
   error:(e:HttpErrorResponse)=>{this.activitySaving.set(false);this.activityError.set(e.error?.message||'No se pudo registrar la actividad.');}
  });
 }
 refreshSelected(id:number):void{const p=this.selectedProspect();if(p?.id===id)this.openProspect(p);}
 savePhone():void{
  const p=this.selectedProspect();if(!p)return;
  const value=this.phoneDraft.trim();
  if(value && value.replace(/\D/g,'').length<8){this.activityError.set('Ingresá un número válido (al menos 8 dígitos).');return;}
  this.phoneTypeSaving.set(true);this.activityError.set('');
  this.prospectService.update(p.id,{nombre:p.nombre,telefono:value,telefono_tipo:'desconocido'},this.auth.getCsrfToken()).subscribe({
   next:()=>{
    const updated={...p,telefono:value,telefono_original:value,telefono_tipo:'desconocido' as const};
    this.selectedProspect.set(updated);
    this.prospects.update(items=>items.map(item=>item.id===p.id?{...item,telefono:value,telefono_original:value,telefono_tipo:'desconocido' as const}:item));
    this.phoneTypeSaving.set(false);this.successMessage.set('Teléfono actualizado correctamente.');
   },
   error:(e:HttpErrorResponse)=>{this.phoneTypeSaving.set(false);this.activityError.set(e.error?.message||'No se pudo actualizar el teléfono.');}
  });
 }
 savePhoneType():void{
  const p=this.selectedProspect();if(!p)return;
  if(!p.telefono){this.activityError.set('Este prospecto no tiene un teléfono para clasificar.');return;}
  this.phoneTypeSaving.set(true);this.activityError.set('');
  this.prospectService.update(p.id,{nombre:p.nombre,telefono:p.telefono,telefono_tipo:this.phoneTypeDraft},this.auth.getCsrfToken()).subscribe({
   next:(r:any)=>{
    const data=r.data||{};
    const updated={...p,telefono:data.telefono??p.telefono,telefono_tipo:data.telefono_tipo??this.phoneTypeDraft};
    this.selectedProspect.set(updated);
    this.prospects.update(items=>items.map(item=>item.id===p.id?{...item,telefono:updated.telefono,telefono_tipo:updated.telefono_tipo}:item));
    this.phoneTypeDraft=updated.telefono_tipo as 'celular'|'fijo'|'desconocido';
    this.phoneTypeSaving.set(false);
    this.successMessage.set('Tipo de línea actualizado correctamente.');
   },
   error:(e:HttpErrorResponse)=>{this.phoneTypeSaving.set(false);this.activityError.set(e.error?.message||'No se pudo actualizar el tipo de línea.');}
  });
 }
 changeProspectStatus(eventValue:string):void{
  const p=this.selectedProspect();if(!p)return;this.statusSaving.set(true);
  this.prospectService.update(p.id,{nombre:p.nombre,estado:eventValue},this.auth.getCsrfToken()).subscribe({next:()=>{this.statusSaving.set(false);this.selectedProspect.set({...p,estado:eventValue});this.loadProspects(this.prospectPage());},error:(e:HttpErrorResponse)=>{this.statusSaving.set(false);this.activityError.set(e.error?.message||'No se pudo actualizar el estado.');}});
 }
 canOpenWhatsApp(p:Prospect|null=this.selectedProspect()):boolean{
  if(!p||!this.phoneDraft.trim()||!this.activityMessage.trim())return false;
  return this.phoneDraft.replace(/\D/g,'').length>=8;
 }
 whatsAppDisabledReason(p:Prospect):string{
  if(!this.phoneDraft.trim())return 'Ingresá un teléfono para habilitar WhatsApp';
  if(this.phoneDraft.replace(/\D/g,'').length<8)return 'El número parece incompleto';
  return '';
 }
 openWhatsApp():void{
  const p=this.selectedProspect();
  if(!this.canOpenWhatsApp(p)){this.activityError.set(this.whatsAppDisabledReason(p||({telefono_tipo:'desconocido'} as Prospect))||'El número no es celular.');return;}
  if(!this.activityMessage.trim()){this.activityError.set('Prepará el mensaje antes de abrir WhatsApp.');return;}
  let phone=this.phoneDraft.replace(/\D/g,'');
  if(phone.startsWith('00'))phone=phone.slice(2);
  if(phone.startsWith('0'))phone=phone.slice(1);
  if(!phone.startsWith('54'))phone='549'+phone;
  else if(phone.startsWith('54')&&!phone.startsWith('549'))phone='549'+phone.slice(2);
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(this.activityMessage),'_blank','noopener');
 }
}
