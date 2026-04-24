import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['externalId'], { unique: true })
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'external_id', length: 50 })
  externalId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 50 })
  timezone!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}