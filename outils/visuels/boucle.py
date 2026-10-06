"""Transforme une vidéo générée en boucle sans coupure pour l'application.

La dernière seconde est fondue dans la première (fondu enchaîné), puis la vidéo est réduite et compressée en H.264.

Usage : python outils/visuels/boucle.py <ffmpeg> <source.mp4> <sortie.mp4> [largeur=1600] [crf=27]
"""
import subprocess
import sys


def main() -> None:
    ffmpeg, source, sortie = sys.argv[1:4]
    largeur = int(sys.argv[4]) if len(sys.argv) > 4 else 1600
    crf = sys.argv[5] if len(sys.argv) > 5 else '27'
    filtre = (f"[0:v]scale={largeur}:-2,fps=30,split[a][b];"
              "[a]trim=start_frame=30:end_frame=195,setpts=PTS-STARTPTS,fps=30,settb=AVTB[A];"
              "[b]trim=start_frame=1:end_frame=31,setpts=PTS-STARTPTS,fps=30,settb=AVTB[B];"
              "[A][B]xfade=transition=fade:duration=1:offset=4.5,trim=start_frame=1,setpts=PTS-STARTPTS[v]")
    subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', source, '-an', '-filter_complex', filtre, '-map', '[v]', '-r', '30',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', sortie], check=True)


main()
