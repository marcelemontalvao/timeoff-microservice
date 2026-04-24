import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';
import { Location } from '../../location/entities/location.entity';

@Entity()
@Unique(['employeeId', 'locationId'])
export class Balance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id' })
  employeeId!: string;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'location_id' })
  locationId!: string;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location?: Location;

  @Column({ type: 'integer', default: 0 })
  balance!: number;

  @Column({ type: 'integer', default: 0 })
  reserved!: number;

  @Column({ type: 'integer', default: 0 })
  used!: number;

  @Column({ name: 'last_synced_at', type: 'datetime', nullable: true })
  lastSyncedAt?: Date;

  @Column({ name: 'hcm_version', nullable: true })
  hcmVersion?: string;

  @Column({ name: 'idempotency_key', nullable: true, length: 100 })
  idempotencyKey?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}