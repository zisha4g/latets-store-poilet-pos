import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export function usePbxManager(user) {
  const [pbxData, setPbxData] = useState({
    businessHours: [],
    ivrMenus: [],
    audioFiles: [],
    extensions: [],
    callLogs: [],
    voicemails: [],
  });

  const fetchPbxData = useCallback(async () => {
    if (!user) return;
    const [hoursRes, ivrRes, audioRes, extRes, logsRes, voicemailsRes] = await Promise.all([
      supabase.from('pbx_business_hours').select('*').eq('user_id', user.id),
      supabase.from('pbx_ivr_menus').select('*').eq('user_id', user.id),
      supabase.from('pbx_audio_files').select('*').eq('user_id', user.id),
      supabase.from('pbx_extensions').select('*').eq('user_id', user.id),
      supabase.from('pbx_call_logs').select('*, customers(name)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pbx_voicemails').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    setPbxData({
      businessHours: hoursRes.data || [],
      ivrMenus: ivrRes.data || [],
      audioFiles: audioRes.data || [],
      extensions: extRes.data || [],
      callLogs: logsRes.data || [],
      voicemails: voicemailsRes.data || [],
    });
    
    const errors = [hoursRes.error, ivrRes.error, audioRes.error, extRes.error, logsRes.error, voicemailsRes.error].filter(Boolean);
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join(', '));
    }
  }, [user]);

  const handlers = {
    business_hours: {
      upsert: async (hours) => {
        const { error } = await supabase.from('pbx_business_hours').upsert(
          hours.map(h => ({...h, user_id: user.id})), 
          { onConflict: 'user_id,day_of_week' }
        );
        if (error) throw error;
        await fetchPbxData();
      }
    },
    audio_files: {
      add: async (file) => {
        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('pbx_audio').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('pbx_audio').getPublicUrl(filePath);
        const { data, error } = await supabase.from('pbx_audio_files').insert({ user_id: user.id, name: file.name, file_url: publicUrl }).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, audioFiles: [...d.audioFiles, data] }));
      },
      delete: async (id) => {
        const fileToDelete = pbxData.audioFiles.find(f => f.id === id);
        if (fileToDelete) {
           const path = new URL(fileToDelete.file_url).pathname.split('/pbx_audio/')[1];
           await supabase.storage.from('pbx_audio').remove([path]);
        }
        const { error } = await supabase.from('pbx_audio_files').delete().eq('id', id);
        if (error) throw error;
        setPbxData(d => ({ ...d, audioFiles: d.audioFiles.filter(f => f.id !== id) }));
      }
    },
    ivr_menus: {
      add: async (menu) => {
        const { data, error } = await supabase.from('pbx_ivr_menus').insert({ ...menu, user_id: user.id }).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, ivrMenus: [...d.ivrMenus, data] }));
      },
      update: async (menu) => {
        const { data, error } = await supabase.from('pbx_ivr_menus').update(menu).eq('id', menu.id).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, ivrMenus: d.ivrMenus.map(m => m.id === menu.id ? data : m) }));
      },
      delete: async (id) => {
        const { error } = await supabase.from('pbx_ivr_menus').delete().eq('id', id);
        if (error) throw error;
        setPbxData(d => ({ ...d, ivrMenus: d.ivrMenus.filter(m => m.id !== id) }));
      }
    },
    extensions: {
      add: async (ext) => {
        const { data, error } = await supabase.from('pbx_extensions').insert({ ...ext, user_id: user.id }).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, extensions: [...d.extensions, data] }));
      },
      update: async (ext) => {
        const { data, error } = await supabase.from('pbx_extensions').update(ext).eq('id', ext.id).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, extensions: d.extensions.map(e => e.id === ext.id ? data : e) }));
      },
      delete: async (id) => {
        const { error } = await supabase.from('pbx_extensions').delete().eq('id', id);
        if (error) throw error;
        setPbxData(d => ({ ...d, extensions: d.extensions.filter(e => e.id !== id) }));
      }
    },
    call_logs: {
      add: async (log) => {
        const { data, error } = await supabase.from('pbx_call_logs').insert({ ...log, user_id: user.id }).select('*, customers(name)').single();
        if (error) throw error;
        setPbxData(d => ({ ...d, callLogs: [data, ...d.callLogs] }));
        return data;
      }
    },
    voicemails: {
      update: async (id, updates) => {
        const { data, error } = await supabase.from('pbx_voicemails').update(updates).eq('id', id).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, voicemails: d.voicemails.map(v => v.id === id ? data : v) }));
      },
      delete: async (id) => {
        const { error } = await supabase.from('pbx_voicemails').delete().eq('id', id);
        if (error) throw error;
        setPbxData(d => ({ ...d, voicemails: d.voicemails.filter(v => v.id !== id) }));
      }
    }
  };

  return { pbxData, fetchPbxData, pbxHandlers: handlers };
}