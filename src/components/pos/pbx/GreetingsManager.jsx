import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Upload, Music, Trash2 } from 'lucide-react';

const GreetingsManager = ({ audioFiles, handlers }) => {
  const fileInputRef = useRef(null);

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      await handlers.add(file);
      toast({ title: 'Success', description: 'Audio file uploaded.' });
    } catch (error) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id) => {
     if (window.confirm('Are you sure you want to delete this audio file?')) {
        try {
            await handlers.delete(id);
            toast({ title: 'Success', description: 'Audio file deleted.' });
        } catch (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Greetings & Audio</CardTitle>
          <CardDescription>Manage audio files for greetings, IVR prompts, and music on hold.</CardDescription>
        </div>
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Upload Audio
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="audio/mpeg, audio/wav" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {audioFiles.map(file => (
            <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <audio controls src={file.file_url} className="h-10" />
                <Button variant="destructive" size="icon" onClick={() => handleDelete(file.id)}>
                    <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
           {audioFiles.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No audio files uploaded yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GreetingsManager;