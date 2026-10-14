"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  GraduationCap,
  Calculator,
  ClipboardList,
  Users,
  BookOpen,
  BarChart3,
  Shield,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  {
    icon: Calculator,
    title: "Avtomatik hisoblash",
    description:
      "Professor-o'qituvchilar yuklamasini O'zbekiston Respublikasi Oliy va o'rta ta'lim vazirligi 3076-son buyrug'iga muvofiq avtomatik hisoblaydi.",
  },
  {
    icon: ClipboardList,
    title: "Shaxsiy ish reja",
    description:
      "Har bir o'qituvchi uchun individual shaxsiy ish rejasini shakllantiradi va boshqaradi, barcha zarur ma'lumotlarni bitta joyda saqlaydi.",
  },
  {
    icon: Users,
    title: "O'qituvchilar bazasi",
    description:
      "Kafedra va fakultet o'qituvchilari haqida to'liq ma'lumotlar bazasini yuritadi, ilmiy daraja va unvonlarni hisobga oladi.",
  },
  {
    icon: BookOpen,
    title: "Fanlar va guruhlar",
    description:
      "O'quv rejalaridagi barcha fanlar va talabalar guruhlarini tizimli tarzda boshqarish imkoniyatini beradi.",
  },
  {
    icon: BarChart3,
    title: "Hisobotlar",
    description:
      "Kafedra, fakultet va universitet bo'yicha batafsil yuklama tahlili va hisobotlarni avtomatik tayyorlaydi.",
  },
  {
    icon: Shield,
    title: "Xavfsizlik",
    description:
      "Barcha ma'lumotlar maxfiyligi va tizim xavfsizligi ta'minlanadi, rolga asoslangan kirish huquqlari bilan.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header / Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/ustoz-logo.png"
              alt="ProYuk"
              className="h-11 w-11 rounded-lg"
            />
            <span className="hidden text-2xl font-bold tracking-tight text-foreground sm:inline">
              Pro<span className="text-primary">Yuk</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* CTA — only visible before login */}
            <Link href="/login">
              <Button size="default" className="px-4 sm:px-6">
                Tizimga kirish
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/3 blur-3xl -translate-y-1/2" />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Text content */}
              <motion.div
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={0}
                className="text-center lg:text-left"
              >
                <motion.div
                  variants={fadeUp}
                  custom={0}
                  className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-6"
                >
                  <GraduationCap className="h-4 w-4 text-primary" />
                  O&apos;zbekiston OTM uchun
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  custom={1}
                  className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
                >
                  Oliy ta&apos;lim muassasalari uchun professor-o&apos;qituvchilar{" "}
                  <span className="text-primary">yuklamasini hisoblash</span>{" "}
                  tizimi
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  custom={2}
                  className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground mx-auto lg:mx-0"
                >
                  ProYuk — O&apos;zbekiston Respublikasi Oliy va o&apos;rta
                  ta&apos;lim vazirligining 3076-son buyrug&apos;iga asosan
                  ishlab chiqilgan, professor-o&apos;qituvchilar yuklamasini
                  avtomatik hisoblaydigan zamonaviy tizim.
                </motion.p>

                <motion.div
                  variants={fadeUp}
                  custom={3}
                  className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
                >
                  <Link href="/login">
                    <Button size="lg" className="text-base px-8 py-6">
                      Tizimga kirish
                    </Button>
                  </Link>
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-8 py-6"
                  >
                    Batafsil ma&apos;lumot
                  </Button>
                </motion.div>

                <motion.div
                  variants={fadeUp}
                  custom={4}
                  className="mt-10 flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    3076-son buyrug&apos;i
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Avtomatik hisoblash
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    Xavfsiz
                  </div>
                </motion.div>
              </motion.div>

              {/* Hero illustration */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                className="relative hidden lg:block"
              >
                <div className="relative rounded-2xl overflow-hidden border shadow-2xl shadow-primary/10 bg-gradient-to-br from-primary/5 to-primary/10 p-6">
                  <img
                    src="/hero-illustration.png"
                    alt="Professor-o'qituvchi yuklamasini hisoblash"
                    className="w-full h-auto rounded-xl"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-16"
            >
              <motion.h2
                variants={fadeUp}
                custom={0}
                className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Tizim imkoniyatlari
              </motion.h2>
              <motion.p
                variants={fadeUp}
                custom={1}
                className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto"
              >
                ProYuk universitet professor-o&apos;qituvchilarining yuklamasini
                boshqarish uchun zarur bo&apos;lgan barcha vositalarni bitta
                platformada jamlaydi.
              </motion.p>
            </motion.div>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
            >
              {features.map((feature, index) => (
                <motion.div key={feature.title} variants={fadeUp} custom={index}>
                  <Card className="h-full border bg-card transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20">
                    <CardContent className="p-6 text-center">
                      <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                        <feature.icon className="h-7 w-7" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-100px" }}
              className="relative overflow-hidden rounded-2xl bg-primary px-6 py-16 sm:px-12 sm:py-20 text-center"
            >
              {/* Background decoration */}
              <div className="absolute inset-0 -z-0">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-primary-foreground/10 -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-primary-foreground/10 translate-y-1/2 -translate-x-1/2" />
              </div>

              <motion.div variants={fadeUp} custom={0} className="relative z-10">
                <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
                  Tizimdan foydalanishni boshlang
                </h2>
                <p className="mt-4 text-lg text-primary-foreground/80 max-w-xl mx-auto">
                  ProYuk yordamida universitetingizdagi barcha
                  professor-o&apos;qituvchilarning yuklamasini tez va aniq
                  hisoblang.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/login">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="text-base px-8 py-6"
                    >
                      Tizimga kirish
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <img
                src="/ustoz-logo.png"
                alt="ProYuk"
                className="h-5 w-5 rounded"
              />
              <span>
                &copy; {new Date().getFullYear()} ProYuk. Barcha huquqlar
                himoyalangan.
              </span>
            </div>
            <Separator orientation="vertical" className="hidden sm:block h-4" />
            <p className="text-xs text-muted-foreground">
              O&apos;zbekiston Respublikasi OTV 3076-son buyrug&apos;iga asosan
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
