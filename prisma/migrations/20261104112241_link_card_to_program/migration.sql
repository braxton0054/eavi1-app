-- AddForeignKey
ALTER TABLE "id_cards" ADD CONSTRAINT "id_cards_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
