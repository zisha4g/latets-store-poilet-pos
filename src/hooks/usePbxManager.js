import { useState, useCallback, useEffect } from 'react';
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
    const [hoursRes, ivrRes, audioRes, extRes, ringersRes, logsRes, voicemailsRes] = await Promise.all([
      supabase.from('pbx_business_hours').select('*').eq('user_id', user.id),
      supabase.from('pbx_ivr_menus').select('*').eq('user_id', user.id),
      supabase.from('pbx_audio_files').select('*').eq('user_id', user.id),
      supabase.from('pbx_extensions').select('*').eq('user_id', user.id),
      supabase.from('pbx_extension_ringers').select('*').eq('user_id', user.id).order('priority', { ascending: true }),
      supabase.from('pbx_call_logs').select('*, customers(name)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('pbx_voicemails').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const allRingers = ringersRes.data || [];
    const extensionsWithRingers = (extRes.data || []).map((e) => ({
      ...e,
      ringers: allRingers.filter((r) => r.extension_id === e.id),
    }));

    setPbxData({
      businessHours: hoursRes.data || [],
      ivrMenus: ivrRes.data || [],
      audioFiles: audioRes.data || [],
      extensions: extensionsWithRingers,
      callLogs: logsRes.data || [],
      voicemails: voicemailsRes.data || [],
    });

    const errors = [hoursRes.error, ivrRes.error, audioRes.error, extRes.error, ringersRes.error, logsRes.error, voicemailsRes.error].filter(Boolean);
    if (errors.length > 0) {
      throw new Error(errors.map(e => e.message).join(', '));
    }
  }, [user]);

  // Realtime: keep callLogs fresh as voice-events writes/updates rows.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`pbx_call_logs_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pbx_call_logs', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setPbxData((d) => {
            const list = d.callLogs || [];
            if (payload.eventType === 'INSERT') {
              if (list.some((l) => l.id === payload.new.id)) return d;
              return { ...d, callLogs: [payload.new, ...list] };
            }
            if (payload.eventType === 'UPDATE') {
              return {
                ...d,
                callLogs: list.map((l) =>
                  l.id === payload.new.id ? { ...l, ...payload.new } : l
                ),
              };
            }
            if (payload.eventType === 'DELETE') {
              return { ...d, callLogs: list.filter((l) => l.id !== payload.old.id) };
            }
            return d;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
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
      add: async (file, displayName) => {
        const safeName = (displayName || file.name || `audio-${Date.now()}`).replace(/[^A-Za-z0-9._-]/g, '_');
        const filePath = `${user.id}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('pbx_audio').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('pbx_audio').getPublicUrl(filePath);
        const { data, error } = await supabase.from('pbx_audio_files').insert({ user_id: user.id, name: displayName || file.name, file_url: publicUrl }).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, audioFiles: [...d.audioFiles, data] }));
        return data;
      },
      rename: async (id, name) => {
        const { data, error } = await supabase.from('pbx_audio_files').update({ name }).eq('id', id).eq('user_id', user.id).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, audioFiles: d.audioFiles.map(f => f.id === id ? { ...f, ...data } : f) }));
        return data;
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
        const { ringers: _r, ...payload } = ext || {};
        const { data, error } = await supabase.from('pbx_extensions').insert({ ...payload, user_id: user.id }).select().single();
        if (error) throw error;
        setPbxData(d => ({ ...d, extensions: [...d.extensions, { ...data, ringers: [] }] }));
        return data;
      },
      update: async (ext) => {
        const { ringers: _r, ...payload } = ext || {};
        const { data, error } = await supabase.from('pbx_extensions').update(payload).eq('id', ext.id).select().single();
        if (error) throw error;
        setPbxData(d => ({
          ...d,
          extensions: d.extensions.map(e => e.id === ext.id ? { ...e, ...data } : e),
        }));
        return data;
      },
      delete: async (id) => {
        const { error } = await supabase.from('pbx_extensions').delete().eq('id', id);
        if (error) throw error;
        setPbxData(d => ({ ...d, extensions: d.extensions.filter(e => e.id !== id) }));
      },
      ringers: {
        add: async (extensionId, ringer) => {
          const { data, error } = await supabase
            .from('pbx_extension_ringers')
            .insert({ ...ringer, extension_id: extensionId, user_id: user.id })
            .select()
            .single();
          if (error) throw error;
          setPbxData(d => ({
            ...d,
            extensions: d.extensions.map(e =>
              e.id === extensionId ? { ...e, ringers: [...(e.ringers || []), data] } : e
            ),
          }));
          return data;
        },
        update: async (ringer) => {
          const { id, extension_id, user_id: _u, ...patch } = ringer;
          const { data, error } = await supabase
            .from('pbx_extension_ringers')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
          if (error) throw error;
          setPbxData(d => ({
            ...d,
            extensions: d.extensions.map(e =>
              e.id === (extension_id || data.extension_id)
                ? { ...e, ringers: (e.ringers || []).map(r => r.id === id ? data : r) }
                : e
            ),
          }));
          return data;
        },
        delete: async (extensionId, ringerId) => {
          const { error } = await supabase.from('pbx_extension_ringers').delete().eq('id', ringerId);
          if (error) throw error;
          setPbxData(d => ({
            ...d,
            extensions: d.extensions.map(e =>
              e.id === extensionId
                ? { ...e, ringers: (e.ringers || []).filter(r => r.id !== ringerId) }
                : e
            ),
          }));
        },
      },
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