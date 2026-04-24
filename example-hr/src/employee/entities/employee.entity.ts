import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Location } from '../../location/entities/location.entity';
import { Balance } from '../../balance/entities/balance.entity';
import { TimeOffRequest } from '../../time-off-request/entities/time-off-request.entity';

@Entity()
@Index(['externalId'], { unique: true })
@Index(['email'], { unique: true })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'external_id', length: 50 })
  externalId!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 255 })
  email!: string;

  @Column({ name: 'location_id', nullable: true })
  locationId?: string;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location?: Location;

  @OneToMany(() => Balance, (balance) => balance.employee)
  balances?: Balance[];

  @OneToMany(() => TimeOffRequest, (request) => request.employee)
  timeOffRequests?: TimeOffRequest[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}