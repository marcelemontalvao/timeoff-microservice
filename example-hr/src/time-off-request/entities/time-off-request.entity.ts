import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Employee } from '../../employee/entities/employee.entity';
import { Location } from '../../location/entities/location.entity';

export type TimeOffStatus = 'PENDING' | 'HCM_SYNCING' | 'APPROVED' | 'REJECTED';

@Entity()
@Index(['employeeId', 'startDate', 'days'])
export class TimeOffRequest {
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

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate!: string;

  @Column({ type: 'integer' })
  days!: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status!: TimeOffStatus;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'hcm_response_id', nullable: true, length: 100 })
  hcmResponseId?: string;

  @Column({ name: 'local_approval', default: false })
  localApproval!: boolean;

  @Column({ name: 'hcm_approved', default: false })
  hcmApproved!: boolean;

  @Column({ name: 'idempotency_key', nullable: true, length: 100 })
  idempotencyKey?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}