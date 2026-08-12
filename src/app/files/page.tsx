import Link from "next/link";
import { ArrowLeft, FolderOpen, HardDrive, Upload } from "lucide-react";
import { VantaMark } from "@/components/brand";
import { requirePageUser } from "@/server/auth";
export const metadata = { title: "Files" };
export const dynamic = "force-dynamic";
export default async function FilesPage() { await requirePageUser(); return <main className="files-preview"><header><VantaMark /><Link href="/browse"><ArrowLeft size={17} />Back to Vanta</Link></header><section><div className="files-visual"><span><FolderOpen /></span><span><Upload /></span><span><HardDrive /></span></div><span className="eyebrow">THE NEXT ROOM IN VANTA</span><h1>Your files are coming home.</h1><p>Private uploads, downloads, folders and storage management are the next build phase. The media foundation is already designed to sit beside them.</p><Link className="secondary-button" href="/browse">Return to your library</Link></section></main>; }
