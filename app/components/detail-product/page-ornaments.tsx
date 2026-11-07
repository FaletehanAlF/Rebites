'use client';
import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Leaf } from 'lucide-react';
import { ArcLines, DotPattern, FloatingLeaf, LeafSprig, } from '@/app/components/shared/ornaments';
export function PageOrnaments() {
    const ref = useRef<HTMLDivElement>(null);
    const reduce = useReducedMotion();
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ['start start', 'end start'],
    });
    const y1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
    const y2 = useTransform(scrollYProgress, [0, 1], [0, 60]);
    const y3 = useTransform(scrollYProgress, [0, 1], [0, -30]);
    return (<div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div style={{ y: reduce ? 0 : y1 }} className="absolute -left-32 -top-28 h-[24rem] w-[24rem] rounded-[55%_45%_60%_40%_/50%_55%_45%_50%] bg-primary/[0.07] blur-3xl"/>
      <motion.div style={{ y: reduce ? 0 : y2 }} className="absolute -right-32 top-40 h-[26rem] w-[26rem] rounded-[45%_55%_50%_50%_/55%_45%_55%_45%] bg-primary/10 blur-3xl"/>
      <motion.div style={{ y: reduce ? 0 : y3 }} className="absolute -left-40 top-[42rem] h-[28rem] w-[28rem] rounded-[40%_60%_55%_45%_/45%_55%_40%_60%] bg-primary/10 blur-3xl"/>

      <motion.div style={{ y: reduce ? 0 : y2 }} className="absolute -right-12 top-24 hidden h-[360px] w-[680px] text-muted-foreground/20 lg:block">
        <ArcLines className="h-full w-full"/>
      </motion.div>

      <motion.div style={{ y: reduce ? 0 : y1 }} className="absolute left-6 top-80 hidden h-24 w-24 text-primary/10 lg:block">
        <DotPattern className="h-full w-full"/>
      </motion.div>

      <LeafSprig className="-left-6 top-72 hidden h-44 w-44 -rotate-12 text-muted-foreground/25 lg:block"/>

      {reduce ? (<Leaf className="absolute right-8 top-72 hidden h-5 w-5 text-muted-foreground/40 lg:block" strokeWidth={1.5}/>) : (<FloatingLeaf className="right-8 top-72 hidden h-5 w-5 text-muted-foreground/40 lg:block" delay={1.2}/>)}

      {reduce ? (<Leaf className="absolute left-8 top-[58rem] hidden h-5 w-5 text-muted-foreground/40 lg:block" strokeWidth={1.5}/>) : (<FloatingLeaf className="left-8 top-[58rem] hidden h-5 w-5 text-muted-foreground/40 lg:block" delay={0.4}/>)}
    </div>);
}
