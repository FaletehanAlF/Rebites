'use client';
import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from '@/app/components/shared/SmartImage';
interface PhotoPickerProps {
    value: string;
    onChange: (value: string) => void;
}
export function PhotoPicker({ value, onChange }: PhotoPickerProps) {
    const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result as string);
        reader.readAsDataURL(file);
        event.target.value = '';
    };
    return (<div>

      {value ? (<div className="relative h-44 overflow-hidden rounded-2xl border border-border">

          <SmartImage src={value} alt="Pratinjau foto menu"/>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-foreground/85 to-transparent p-3">

            <label htmlFor="menu-photo-input" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-white">

              <ImagePlus className="h-3.5 w-3.5"/>

              Ganti Foto

            </label>

            <button type="button" onClick={() => onChange('')} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/25 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-secondary/40">

              <Trash2 className="h-3.5 w-3.5"/>

              Hapus

            </button>

          </div>

        </div>) : (<label htmlFor="menu-photo-input" className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-border bg-secondary text-center transition-colors hover:border-primary/30 hover:bg-muted/40">

          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary">

            <Camera className="h-6 w-6"/>

          </span>

          <span>

            <span className="block text-sm font-semibold text-foreground">

              Upload Foto Menu

            </span>

            <span className="mt-0.5 block text-[11px] text-muted-foreground">

              PNG atau JPG, maksimal 5 MB

            </span>

          </span>

        </label>)}



      <input id="menu-photo-input" type="file" accept="image/*" className="sr-only" onChange={handleFile}/>

    </div>);
}
